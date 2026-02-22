import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  auditEvents,
  documents,
  manualReviewItems,
  reconciliationChecks,
  transactionDocuments,
  transactions
} from "@/db/schema";
import type {
  AuditEventType,
  DocumentType,
  ExtractedDocument,
  ReconciliationCheckStatus,
  ReconciliationCheckType,
  TransactionDocumentRole,
  TransactionState
} from "@/types/domain";

export type DocumentFilters = {
  status?: string;
  docType?: string;
  q?: string;
  confidenceBelow?: number;
};

export type TransactionFilters = {
  state?: string;
  vendor?: string;
  country?: string;
  currency?: string;
  q?: string;
};

export async function getDocumentBySha256(sha256: string) {
  return db.query.documents.findFirst({ where: eq(documents.sha256, sha256) });
}

export async function createDiscoveredDocument(input: {
  sourcePath: string;
  fileName: string;
  sha256: string;
  mimeType: string | null;
  sizeBytes: number;
}) {
  const [row] = await db
    .insert(documents)
    .values({
      sourcePath: input.sourcePath,
      fileName: input.fileName,
      sha256: input.sha256,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      status: "NEW"
    })
    .returning();

  return row;
}

export async function touchDocumentMetadata(
  documentId: string,
  input: { sourcePath: string; fileName: string; mimeType: string | null; sizeBytes: number }
) {
  await db
    .update(documents)
    .set({
      sourcePath: input.sourcePath,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      updatedAt: new Date()
    })
    .where(eq(documents.id, documentId));
}

export async function listPendingDocuments(limit: number, includeFailed: boolean) {
  const statuses = includeFailed ? (["NEW", "FAILED"] as const) : (["NEW"] as const);
  return db.query.documents.findMany({
    where: inArray(documents.status, statuses),
    orderBy: [asc(documents.firstSeenAt)],
    limit
  });
}

export async function markDocumentProcessed(
  documentId: string,
  input: {
    rawText: string;
    docType: DocumentType;
    confidence: number;
    extractedJson: ExtractedDocument;
    poNumber: string;
    invoiceNumber: string;
    grnNumber: string;
    vendorName: string;
    vendorId: string;
    country: string;
    currency: string;
    docDate: Date | null;
    dueDate: Date | null;
    totalAmount: number | null;
    taxAmount: number | null;
  }
) {
  const [row] = await db
    .update(documents)
    .set({
      status: "PROCESSED",
      rawText: input.rawText,
      docType: input.docType,
      confidence: input.confidence,
      extractedJson: input.extractedJson,
      poNumber: input.poNumber || null,
      invoiceNumber: input.invoiceNumber || null,
      grnNumber: input.grnNumber || null,
      vendorName: input.vendorName || null,
      vendorId: input.vendorId || null,
      country: input.country || null,
      currency: input.currency || null,
      docDate: input.docDate,
      dueDate: input.dueDate,
      totalAmount: input.totalAmount?.toFixed(2) ?? null,
      taxAmount: input.taxAmount?.toFixed(2) ?? null,
      errorMessage: null,
      processedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(documents.id, documentId))
    .returning();

  return row;
}

export async function markDocumentFailed(documentId: string, message: string) {
  const [row] = await db
    .update(documents)
    .set({
      status: "FAILED",
      errorMessage: message,
      updatedAt: new Date()
    })
    .where(eq(documents.id, documentId))
    .returning();

  return row;
}

export async function createAuditEvent(input: {
  transactionId?: string;
  documentId?: string;
  eventType: AuditEventType;
  message: string;
  meta?: Record<string, unknown>;
}) {
  await db.insert(auditEvents).values({
    transactionId: input.transactionId ?? null,
    documentId: input.documentId ?? null,
    eventType: input.eventType,
    message: input.message,
    meta: input.meta ?? {}
  });
}

export async function createManualReviewItem(documentId: string, reason: string) {
  await db.insert(manualReviewItems).values({
    documentId,
    reason,
    status: "OPEN"
  });
}

export async function resolveManualReviewByDocument(documentId: string) {
  const rows = await db
    .update(manualReviewItems)
    .set({
      status: "RESOLVED",
      resolvedAt: new Date()
    })
    .where(and(eq(manualReviewItems.documentId, documentId), eq(manualReviewItems.status, "OPEN")))
    .returning({ id: manualReviewItems.id });

  return rows.length;
}

export async function resolveManualReviewsByTransaction(transactionId: string, notes?: string) {
  const result = await db.execute(sql`
    update manual_review_items
    set
      status = 'RESOLVED',
      resolved_at = now(),
      notes = case
        when ${notes ?? null}::text is null or ${notes ?? null}::text = '' then notes
        else ${notes ?? null}::text
      end
    where status = 'OPEN'
      and document_id in (
        select document_id
        from transaction_documents
        where transaction_id = ${transactionId}
      )
    returning id
  `);

  return Number(result.rowCount ?? 0);
}

export async function upsertTransaction(input: {
  transactionKey: string;
  poNumber?: string;
  vendorName?: string;
  country?: string;
  currency?: string;
}) {
  const existing = await db.query.transactions.findFirst({
    where: eq(transactions.transactionKey, input.transactionKey)
  });

  if (existing) {
    const [updated] = await db
      .update(transactions)
      .set({
        poNumber: input.poNumber || existing.poNumber,
        vendorName: input.vendorName || existing.vendorName,
        country: input.country || existing.country,
        currency: input.currency || existing.currency,
        updatedAt: new Date()
      })
      .where(eq(transactions.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(transactions)
    .values({
      transactionKey: input.transactionKey,
      poNumber: input.poNumber ?? null,
      vendorName: input.vendorName ?? null,
      country: input.country ?? null,
      currency: input.currency ?? null
    })
    .returning();

  return created;
}

export async function attachDocumentToTransaction(
  transactionId: string,
  documentId: string,
  role: TransactionDocumentRole
) {
  const existing = await db.query.transactionDocuments.findFirst({
    where: and(eq(transactionDocuments.transactionId, transactionId), eq(transactionDocuments.documentId, documentId))
  });

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(transactionDocuments)
    .values({
      transactionId,
      documentId,
      role,
      isPrimary: false
    })
    .returning();

  return created;
}

export async function getTransactionDocs(transactionId: string) {
  return db
    .select({
      documentId: documents.id,
      status: documents.status,
      docType: documents.docType,
      poNumber: documents.poNumber,
      invoiceNumber: documents.invoiceNumber,
      grnNumber: documents.grnNumber,
      vendorName: documents.vendorName,
      country: documents.country,
      currency: documents.currency,
      totalAmount: documents.totalAmount,
      confidence: documents.confidence,
      extractedJson: documents.extractedJson,
      fileName: documents.fileName,
      sourcePath: documents.sourcePath,
      role: transactionDocuments.role,
      hasOpenManualReview: sql<boolean>`exists (
        select 1
        from manual_review_items mri
        where mri.document_id = ${documents.id}
          and mri.status = 'OPEN'
      )`,
      latestManualReviewStatus: sql<"OPEN" | "RESOLVED" | null>`(
        select mri.status
        from manual_review_items mri
        where mri.document_id = ${documents.id}
        order by mri.created_at desc
        limit 1
      )`,
      processedAt: documents.processedAt,
      updatedAt: documents.updatedAt
    })
    .from(transactionDocuments)
    .innerJoin(documents, eq(transactionDocuments.documentId, documents.id))
    .where(eq(transactionDocuments.transactionId, transactionId))
    .orderBy(desc(documents.updatedAt));
}

export async function upsertTransactionChecks(
  transactionId: string,
  checks: Array<{ checkType: ReconciliationCheckType; status: ReconciliationCheckStatus; details: Record<string, unknown> }>
) {
  for (const check of checks) {
    const existing = await db.query.reconciliationChecks.findFirst({
      where: and(
        eq(reconciliationChecks.transactionId, transactionId),
        eq(reconciliationChecks.checkType, check.checkType)
      )
    });

    if (existing) {
      await db
        .update(reconciliationChecks)
        .set({ status: check.status, details: check.details, createdAt: new Date() })
        .where(eq(reconciliationChecks.id, existing.id));
    } else {
      await db.insert(reconciliationChecks).values({
        transactionId,
        checkType: check.checkType,
        status: check.status,
        details: check.details
      });
    }
  }
}

export async function updateTransactionState(
  transactionId: string,
  input: {
    state: TransactionState;
    poNumber?: string | null;
    vendorName?: string | null;
    country?: string | null;
    currency?: string | null;
  }
) {
  const [row] = await db
    .update(transactions)
    .set({
      state: input.state,
      poNumber: input.poNumber ?? null,
      vendorName: input.vendorName ?? null,
      country: input.country ?? null,
      currency: input.currency ?? null,
      lastReconciledAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(transactions.id, transactionId))
    .returning();

  return row;
}

export async function listDocuments(filters: DocumentFilters) {
  const clauses = [];

  if (filters.status) {
    clauses.push(eq(documents.status, filters.status as typeof documents.$inferSelect.status));
  }
  if (filters.docType) {
    clauses.push(eq(documents.docType, filters.docType as typeof documents.$inferSelect.docType));
  }
  if (typeof filters.confidenceBelow === "number") {
    clauses.push(sql`${documents.confidence} < ${filters.confidenceBelow}`);
  }
  if (filters.q) {
    const q = `%${filters.q}%`;
    clauses.push(
      or(
        ilike(documents.fileName, q),
        ilike(documents.vendorName, q),
        ilike(documents.poNumber, q),
        ilike(documents.invoiceNumber, q)
      )
    );
  }

  return db.query.documents.findMany({
    where: clauses.length ? and(...clauses) : undefined,
    orderBy: [desc(documents.updatedAt)],
    limit: 500
  });
}

export async function listTransactions(filters: TransactionFilters) {
  const clauses = [];

  if (filters.state) {
    clauses.push(eq(transactions.state, filters.state as typeof transactions.$inferSelect.state));
  }
  if (filters.vendor) {
    clauses.push(ilike(transactions.vendorName, `%${filters.vendor}%`));
  }
  if (filters.country) {
    clauses.push(eq(transactions.country, filters.country));
  }
  if (filters.currency) {
    clauses.push(eq(transactions.currency, filters.currency));
  }
  if (filters.q) {
    const q = `%${filters.q}%`;
    clauses.push(or(ilike(transactions.transactionKey, q), ilike(transactions.poNumber, q), ilike(transactions.vendorName, q)));
  }

  const rows = await db.query.transactions.findMany({
    where: clauses.length ? and(...clauses) : undefined,
    orderBy: [desc(transactions.updatedAt)],
    limit: 500
  });

  const txIds = rows.map((row) => row.id);
  if (!txIds.length) {
    return [];
  }

  const countsByRole = await db
    .select({
      transactionId: transactionDocuments.transactionId,
      role: transactionDocuments.role,
      count: count(transactionDocuments.id)
    })
    .from(transactionDocuments)
    .where(inArray(transactionDocuments.transactionId, txIds))
    .groupBy(transactionDocuments.transactionId, transactionDocuments.role);

  const countsMap = new Map<string, { PO: number; INVOICE: number; GRN: number; OTHER: number }>();
  for (const row of countsByRole) {
    const curr = countsMap.get(row.transactionId) ?? { PO: 0, INVOICE: 0, GRN: 0, OTHER: 0 };
    curr[row.role] = row.count;
    countsMap.set(row.transactionId, curr);
  }

  const reviewEvents = await db.query.auditEvents.findMany({
    where: and(
      inArray(auditEvents.transactionId, txIds),
      eq(auditEvents.eventType, "STATE_UPDATED"),
      eq(auditEvents.message, "Manual review resolved")
    ),
    orderBy: [desc(auditEvents.createdAt)]
  });

  const latestReviewByTx = new Map<string, { notes: string | null }>();
  for (const event of reviewEvents) {
    if (!event.transactionId || latestReviewByTx.has(event.transactionId)) {
      continue;
    }
    const notesRaw = (event.meta ?? {}) as Record<string, unknown>;
    const notes = typeof notesRaw.notes === "string" && notesRaw.notes.trim() ? notesRaw.notes.trim() : null;
    latestReviewByTx.set(event.transactionId, { notes });
  }

  return rows.map((row) => ({
    ...row,
    counts: countsMap.get(row.id) ?? { PO: 0, INVOICE: 0, GRN: 0, OTHER: 0 },
    reviewStatus: latestReviewByTx.has(row.id) ? "DONE" : "PENDING",
    reviewComment: latestReviewByTx.get(row.id)?.notes ?? null
  }));
}

export async function getTransactionById(id: string) {
  return db.query.transactions.findFirst({ where: eq(transactions.id, id) });
}

export async function getTransactionChecks(transactionId: string) {
  return db.query.reconciliationChecks.findMany({
    where: eq(reconciliationChecks.transactionId, transactionId),
    orderBy: [asc(reconciliationChecks.checkType)]
  });
}

export async function getTransactionAuditEvents(transactionId: string) {
  return db.query.auditEvents.findMany({
    where: eq(auditEvents.transactionId, transactionId),
    orderBy: [desc(auditEvents.createdAt)],
    limit: 200
  });
}

export async function getLatestManualReviewResolution(transactionId: string) {
  const row = await db.query.auditEvents.findFirst({
    where: and(
      eq(auditEvents.transactionId, transactionId),
      eq(auditEvents.eventType, "STATE_UPDATED"),
      eq(auditEvents.message, "Manual review resolved")
    ),
    orderBy: [desc(auditEvents.createdAt)]
  });

  if (!row) {
    return null;
  }

  const meta = row.meta ?? {};
  const notes = typeof meta.notes === "string" ? meta.notes : "";
  return {
    notes,
    createdAt: row.createdAt
  };
}

export async function getReportsSummary() {
  const [totalDocs] = await db.select({ value: count(documents.id) }).from(documents);
  const [processedDocs] = await db
    .select({ value: count(documents.id) })
    .from(documents)
    .where(eq(documents.status, "PROCESSED"));
  const [totalTransactions] = await db.select({ value: count(transactions.id) }).from(transactions);
  const [exceptionTransactions] = await db
    .select({ value: count(transactions.id) })
    .from(transactions)
    .where(sql`${transactions.state} <> 'MATCHED'`);

  const stateBreakdown = await db
    .select({ state: transactions.state, count: count(transactions.id) })
    .from(transactions)
    .groupBy(transactions.state)
    .orderBy(asc(transactions.state));

  const exceptionQueue = await db.query.transactions.findMany({
    where: sql`${transactions.state} <> 'MATCHED'`,
    orderBy: [desc(transactions.updatedAt)],
    limit: 20
  });

  return {
    kpis: {
      totalDocs: totalDocs?.value ?? 0,
      processedDocs: processedDocs?.value ?? 0,
      totalTransactions: totalTransactions?.value ?? 0,
      exceptions: exceptionTransactions?.value ?? 0
    },
    stateBreakdown,
    exceptionQueue
  };
}
