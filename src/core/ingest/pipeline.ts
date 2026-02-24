import { and, eq, sql } from "drizzle-orm";

import { getConfig } from "@/core/config";
import { scanRawDirectory } from "@/core/fileScanner";
import { extractWithGemini } from "@/core/gemini/extract";
import { computeChecksForTransaction } from "@/core/reconciliation/checks";
import { computeState } from "@/core/reconciliation/stateMachine";
import { buildTransactionKey } from "@/core/routing/transactionKey";
import { syncDocumentArtifacts, writeTransactionRollup } from "@/core/storage/fsStore";
import { extractTextFromFile } from "@/core/textExtractor";
import { db } from "@/db";
import { documents } from "@/db/schema";
import {
  attachDocumentToTransaction,
  createAuditEvent,
  createDiscoveredDocument,
  createManualReviewItem,
  getDocumentBySha256,
  listPendingDocuments,
  getTransactionById,
  getTransactionDocs,
  markDocumentFailed,
  markDocumentProcessed,
  touchDocumentMetadata,
  upsertTransaction,
  updateTransactionState,
  upsertTransactionChecks
} from "@/db/queries";
import type { TransactionDocumentRole } from "@/types/domain";

function mapDocTypeToRole(docType: string): TransactionDocumentRole {
  if (docType === "PURCHASE_ORDER") {
    return "PO";
  }
  if (docType === "INVOICE") {
    return "INVOICE";
  }
  if (docType === "GOODS_RECEIPT") {
    return "GRN";
  }
  return "OTHER";
}

function parseIsoDate(value: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function summarizeIssue(state: string): string {
  switch (state) {
    case "MATCHED":
      return "All checks passed";
    case "PARSE_FAILED":
      return "At least one document failed extraction";
    case "LOW_CONFIDENCE":
      return "One or more extracted documents have low confidence";
    case "DUPLICATE_INVOICE":
      return "Duplicate invoice number detected";
    case "WAITING_FOR_PO":
      return "Invoice/GRN exists but PO is missing";
    case "WAITING_FOR_INVOICE":
      return "PO and GRN present; invoice is missing";
    case "WAITING_FOR_GOODS_RECEIPT":
      return "PO and invoice present; GRN is missing";
    case "WAITING_FOR_INVOICE_AND_GRN":
      return "PO present; invoice and GRN missing";
    case "FX_OR_REGION_MISMATCH":
      return "Country or currency mismatch across documents";
    case "QTY_MISMATCH":
      return "Goods receipt quantity is less than PO quantity";
    case "AMOUNT_MISMATCH":
      return "Invoice total differs from PO total";
    default:
      return "Pending reconciliation";
  }
}

async function recomputeTransaction(transactionId: string) {
  const config = getConfig();
  const transaction = await getTransactionById(transactionId);
  if (!transaction) {
    throw new Error(`Transaction not found: ${transactionId}`);
  }

  const docs = await getTransactionDocs(transactionId);
  const mappedDocs = docs.map((doc) => ({
    id: doc.documentId,
    status: doc.status,
    docType: doc.docType,
    poNumber: doc.poNumber,
    invoiceNumber: doc.invoiceNumber,
    vendorName: doc.vendorName,
    country: doc.country,
    currency: doc.currency,
    totalAmount: doc.totalAmount,
    confidence: doc.confidence,
    extractedJson: doc.extractedJson
  }));

  const { checks, flags } = computeChecksForTransaction(
    mappedDocs,
    config.confidenceThreshold,
    config.amountTolerancePct
  );

  const state = computeState({
    hasPO: flags.hasPO,
    hasInvoice: flags.hasInvoice,
    hasGRN: flags.hasGRN,
    parseFailed: flags.parseFailed,
    lowConfidence: flags.lowConfidence,
    duplicateInvoice: flags.duplicateInvoice,
    fxMismatch: flags.fxMismatch,
    qtyMismatch: flags.qtyMismatch,
    amountMismatch: flags.amountMismatch
  });

  const representativeDoc =
    mappedDocs.find((doc) => doc.docType === "PURCHASE_ORDER") ??
    mappedDocs.find((doc) => doc.docType === "INVOICE") ??
    mappedDocs.find((doc) => doc.docType === "GOODS_RECEIPT") ??
    mappedDocs[0];

  const updated = await updateTransactionState(transactionId, {
    state,
    poNumber: representativeDoc?.poNumber ?? transaction.poNumber,
    vendorName: representativeDoc?.vendorName ?? transaction.vendorName,
    country: representativeDoc?.country ?? transaction.country,
    currency: representativeDoc?.currency ?? transaction.currency
  });

  await upsertTransactionChecks(transactionId, checks);

  await writeTransactionRollup(transaction.transactionKey, {
    transaction: {
      id: updated.id,
      transactionKey: updated.transactionKey,
      state: updated.state,
      issueSummary: summarizeIssue(updated.state),
      lastReconciledAt: updated.lastReconciledAt,
      updatedAt: updated.updatedAt,
      poNumber: updated.poNumber,
      vendorName: updated.vendorName,
      country: updated.country,
      currency: updated.currency
    },
    checks,
    documents: docs.map((doc) => ({
      documentId: doc.documentId,
      fileName: doc.fileName,
      role: doc.role,
      docType: doc.docType,
      status: doc.status,
      confidence: doc.confidence,
      poNumber: doc.poNumber,
      invoiceNumber: doc.invoiceNumber,
      grnNumber: doc.grnNumber,
      updatedAt: doc.updatedAt
    }))
  });

  await createAuditEvent({
    transactionId,
    eventType: "STATE_UPDATED",
    message: `State updated to ${updated.state}`,
    meta: { state: updated.state }
  });

  await createAuditEvent({
    transactionId,
    eventType: "RECONCILED",
    message: "Reconciliation checks recomputed",
    meta: { checks: checks.length, state: updated.state }
  });

  return updated;
}

export async function scanAndRegisterDocuments() {
  const scannedFiles = await scanRawDirectory();

  let discovered = 0;
  let alreadyProcessed = 0;
  let retriableExisting = 0;

  for (const file of scannedFiles) {
    const existing = await getDocumentBySha256(file.sha256);

    if (!existing) {
      const created = await createDiscoveredDocument(file);
      discovered += 1;
      await createAuditEvent({
        documentId: created.id,
        eventType: "DISCOVERED",
        message: `Discovered raw document ${file.fileName}`,
        meta: { sourcePath: file.sourcePath, sha256: file.sha256 }
      });
      continue;
    }

    await touchDocumentMetadata(existing.id, {
      sourcePath: file.sourcePath,
      fileName: file.fileName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes
    });

    if (existing.status === "PROCESSED") {
      alreadyProcessed += 1;
    } else {
      retriableExisting += 1;
    }
  }

  const [uniqueDocsResult] = await db
    .select({ value: sql<number>`count(distinct ${documents.sha256})` })
    .from(documents);

  return {
    scanned: scannedFiles.length,
    discovered,
    alreadyProcessed,
    retriableExisting,
    uniqueDocumentsInDb: Number(uniqueDocsResult?.value ?? 0)
  };
}

export async function processPendingDocuments(input?: {
  limit?: number;
  retryFailed?: boolean;
  documentId?: string;
}) {
  const config = getConfig();
  const limit = input?.limit ?? config.processBatchSize;
  const retryFailed = input?.retryFailed ?? false;

  const pendingDocs = input?.documentId
    ? await db.query.documents.findMany({ where: eq(documents.id, input.documentId), limit: 1 })
    : await listPendingDocuments(limit, retryFailed);
  const docsToProcess = pendingDocs;

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  const forceDocumentRun = Boolean(input?.documentId);

  for (const doc of docsToProcess) {
    if (!forceDocumentRun && doc.status === "PROCESSED") {
      skipped += 1;
      continue;
    }

    try {
      await createAuditEvent({
        documentId: doc.id,
        eventType: "INGESTED",
        message: `Processing document ${doc.fileName}`,
        meta: { sourcePath: doc.sourcePath }
      });

      const extraction = await extractTextFromFile(doc.sourcePath);
      const initialExtracted = await extractWithGemini({
        rawText: extraction.text,
        fileName: doc.fileName
      });

      let extracted = initialExtracted;
      if (initialExtracted.docType === "INVOICE" && initialExtracted.poNumber) {
        const poDoc = await db.query.documents.findFirst({
          where: and(
            eq(documents.poNumber, initialExtracted.poNumber),
            eq(documents.docType, "PURCHASE_ORDER"),
            eq(documents.status, "PROCESSED")
          ),
          orderBy: (table, { desc }) => [desc(table.updatedAt)]
        });

        if (poDoc?.extractedJson) {
          extracted = await extractWithGemini({
            rawText: extraction.text,
            fileName: doc.fileName,
            poContextJson: poDoc.extractedJson
          });
        }
      }

      const processedDoc = await markDocumentProcessed(doc.id, {
        rawText: extraction.text,
        docType: extracted.docType,
        confidence: extracted.confidence,
        extractedJson: extracted,
        poNumber: extracted.poNumber,
        invoiceNumber: extracted.invoiceNumber,
        grnNumber: extracted.grnNumber,
        vendorName: extracted.vendorName,
        vendorId: extracted.vendorId,
        country: extracted.country,
        currency: extracted.currency,
        docDate: parseIsoDate(extracted.docDate),
        dueDate: parseIsoDate(extracted.dueDate),
        totalAmount: extracted.totalAmount,
        taxAmount: extracted.taxAmount
      });

      await createAuditEvent({
        documentId: processedDoc.id,
        eventType: "EXTRACTED",
        message: `Extraction completed for ${doc.fileName}`,
        meta: {
          docType: extracted.docType,
          confidence: extracted.confidence,
          poNumber: extracted.poNumber,
          invoiceNumber: extracted.invoiceNumber,
          grnNumber: extracted.grnNumber
        }
      });

      const transactionKey = buildTransactionKey(extracted.poNumber, doc.sha256);
      const transaction = await upsertTransaction({
        transactionKey,
        poNumber: extracted.poNumber || undefined,
        vendorName: extracted.vendorName || undefined,
        country: extracted.country || undefined,
        currency: extracted.currency || undefined
      });

      const role = mapDocTypeToRole(extracted.docType);
      await attachDocumentToTransaction(transaction.id, processedDoc.id, role);

      await syncDocumentArtifacts({
        transactionKey,
        sourcePath: doc.sourcePath,
        fileName: doc.fileName,
        documentId: processedDoc.id,
        extractedJson: extracted
      });

      await createAuditEvent({
        transactionId: transaction.id,
        documentId: processedDoc.id,
        eventType: "ROUTED",
        message: `Document attached to transaction ${transactionKey}`,
        meta: { role }
      });

      await recomputeTransaction(transaction.id);
      processed += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "Unknown processing error";

      const failedDoc = await markDocumentFailed(doc.id, message);
      await createManualReviewItem(failedDoc.id, message);

      await createAuditEvent({
        documentId: failedDoc.id,
        eventType: "MANUAL_REVIEW_REQUIRED",
        message: `Manual review required for ${doc.fileName}`,
        meta: { reason: message }
      });

      await createAuditEvent({
        documentId: failedDoc.id,
        eventType: "ERROR",
        message,
        meta: { stage: "processPendingDocuments" }
      });
    }
  }

  return {
    requestedLimit: limit,
    processed,
    failed,
    skipped,
    scannedCandidates: docsToProcess.length
  };
}

export async function rerunExtractionForDocument(documentId: string) {
  return processPendingDocuments({ documentId, retryFailed: true, limit: 1 });
}
