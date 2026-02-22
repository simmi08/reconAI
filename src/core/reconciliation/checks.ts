import type { InferSelectModel } from "drizzle-orm";

import { documents } from "@/db/schema";
import type { CheckResult } from "@/types/domain";

export type ReconciliationDocument = Pick<
  InferSelectModel<typeof documents>,
  | "id"
  | "status"
  | "docType"
  | "poNumber"
  | "invoiceNumber"
  | "vendorName"
  | "country"
  | "currency"
  | "totalAmount"
  | "confidence"
  | "extractedJson"
>;

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function detectDuplicateInvoiceNumbers(invoiceNumbers: string[]): boolean {
  const seen = new Set<string>();
  for (const invoiceNumberRaw of invoiceNumbers) {
    const invoiceNumber = invoiceNumberRaw.trim().toLowerCase();
    if (!invoiceNumber) {
      continue;
    }
    if (seen.has(invoiceNumber)) {
      return true;
    }
    seen.add(invoiceNumber);
  }
  return false;
}

export function isAmountMismatch(
  poTotal: number | null,
  invoiceTotal: number | null,
  tolerancePct: number
): { mismatch: boolean; diffPct: number | null } {
  if (poTotal === null || invoiceTotal === null) {
    return { mismatch: false, diffPct: null };
  }

  if (poTotal === 0) {
    return { mismatch: invoiceTotal !== 0, diffPct: null };
  }

  const diffPct = Math.abs(invoiceTotal - poTotal) / Math.abs(poTotal);
  return { mismatch: diffPct > tolerancePct, diffPct };
}

function getLineItems(document: ReconciliationDocument): Array<{ description: string; quantity: number | null }> {
  const extracted = document.extractedJson;
  if (!extracted || typeof extracted !== "object") {
    return [];
  }

  const lineItemsCandidate = (extracted as Record<string, unknown>).lineItems;
  if (!Array.isArray(lineItemsCandidate)) {
    return [];
  }

  return lineItemsCandidate.map((item) => {
    if (!item || typeof item !== "object") {
      return { description: "", quantity: null };
    }
    const obj = item as Record<string, unknown>;
    return {
      description: typeof obj.description === "string" ? obj.description : "",
      quantity: typeof obj.quantity === "number" ? obj.quantity : null
    };
  });
}

function isQuantityMismatch(poDoc: ReconciliationDocument | undefined, grnDoc: ReconciliationDocument | undefined): boolean {
  if (!poDoc || !grnDoc) {
    return false;
  }

  const poItems = getLineItems(poDoc);
  const grnItems = getLineItems(grnDoc);

  if (!poItems.length || !grnItems.length) {
    return false;
  }

  const grnQtyByDesc = new Map<string, number>();
  for (const item of grnItems) {
    const desc = normalizeText(item.description);
    if (!desc) {
      continue;
    }
    const qty = item.quantity ?? 0;
    grnQtyByDesc.set(desc, qty);
  }

  return poItems.some((poItem) => {
    const desc = normalizeText(poItem.description);
    if (!desc) {
      return false;
    }
    const poQty = poItem.quantity ?? 0;
    const grnQty = grnQtyByDesc.get(desc);
    if (grnQty === undefined) {
      return false;
    }
    return grnQty < poQty;
  });
}

function isFxOrRegionMismatch(docs: ReconciliationDocument[]): boolean {
  const countries = new Set<string>();
  const currencies = new Set<string>();

  for (const doc of docs) {
    const country = (doc.country ?? "").trim().toUpperCase();
    const currency = (doc.currency ?? "").trim().toUpperCase();
    if (country) {
      countries.add(country);
    }
    if (currency) {
      currencies.add(currency);
    }
  }

  return countries.size > 1 || currencies.size > 1;
}

export type CheckComputation = {
  checks: CheckResult[];
  flags: {
    hasPO: boolean;
    hasInvoice: boolean;
    hasGRN: boolean;
    parseFailed: boolean;
    lowConfidence: boolean;
    duplicateInvoice: boolean;
    amountMismatch: boolean;
    qtyMismatch: boolean;
    fxMismatch: boolean;
  };
};

export function computeChecksForTransaction(
  docs: ReconciliationDocument[],
  confidenceThreshold: number,
  amountTolerancePct: number
): CheckComputation {
  const poDocs = docs.filter((doc) => doc.docType === "PURCHASE_ORDER" && doc.status === "PROCESSED");
  const invoiceDocs = docs.filter((doc) => doc.docType === "INVOICE" && doc.status === "PROCESSED");
  const grnDocs = docs.filter((doc) => doc.docType === "GOODS_RECEIPT" && doc.status === "PROCESSED");

  const hasPO = poDocs.length > 0;
  const hasInvoice = invoiceDocs.length > 0;
  const hasGRN = grnDocs.length > 0;
  const parseFailed = docs.some((doc) => doc.status === "FAILED");

  const confidenceDocs = [...poDocs, ...invoiceDocs, ...grnDocs];
  const lowConfidence = confidenceDocs.some(
    (doc) => doc.confidence !== null && doc.confidence !== undefined && doc.confidence < confidenceThreshold
  );

  const duplicateInvoice = detectDuplicateInvoiceNumbers(invoiceDocs.map((doc) => doc.invoiceNumber ?? ""));

  const poPrimary = poDocs[0];
  const invoicePrimary = invoiceDocs[0];
  const grnPrimary = grnDocs[0];

  const amountResult = isAmountMismatch(
    toNumber(poPrimary?.totalAmount),
    toNumber(invoicePrimary?.totalAmount),
    amountTolerancePct
  );
  const qtyMismatch = isQuantityMismatch(poPrimary, grnPrimary);
  const fxMismatch = isFxOrRegionMismatch([...poDocs, ...invoiceDocs, ...grnDocs]);

  const checks: CheckResult[] = [
    {
      checkType: "PO_PRESENT",
      status: hasPO ? "OK" : hasInvoice || hasGRN ? "MISSING" : "PENDING",
      details: { poCount: poDocs.length }
    },
    {
      checkType: "INVOICE_PRESENT",
      status: hasInvoice ? "OK" : hasPO || hasGRN ? "MISSING" : "PENDING",
      details: { invoiceCount: invoiceDocs.length }
    },
    {
      checkType: "GRN_PRESENT",
      status: hasGRN ? "OK" : hasPO || hasInvoice ? "MISSING" : "PENDING",
      details: { grnCount: grnDocs.length }
    },
    {
      checkType: "AMOUNT_MATCH",
      status: hasPO && hasInvoice ? (amountResult.mismatch ? "MISMATCH" : "OK") : "PENDING",
      details: {
        poTotal: toNumber(poPrimary?.totalAmount),
        invoiceTotal: toNumber(invoicePrimary?.totalAmount),
        diffPct: amountResult.diffPct
      }
    },
    {
      checkType: "QUANTITY_MATCH",
      status: hasPO && hasGRN ? (qtyMismatch ? "MISMATCH" : "OK") : "PENDING",
      details: {
        compared: hasPO && hasGRN,
        method: "line_item_description_quantity"
      }
    },
    {
      checkType: "DUPLICATE_INVOICE",
      status: duplicateInvoice ? "MISMATCH" : "OK",
      details: {
        invoiceNumbers: invoiceDocs.map((doc) => doc.invoiceNumber)
      }
    },
    {
      checkType: "FX_OR_REGION_MATCH",
      status: hasPO && (hasInvoice || hasGRN) ? (fxMismatch ? "MISMATCH" : "OK") : "PENDING",
      details: {
        countries: [...new Set(docs.map((doc) => doc.country).filter(Boolean))],
        currencies: [...new Set(docs.map((doc) => doc.currency).filter(Boolean))]
      }
    },
    {
      checkType: "LOW_CONFIDENCE",
      status: lowConfidence ? "MISMATCH" : "OK",
      details: {
        threshold: confidenceThreshold,
        belowThresholdDocumentIds: confidenceDocs
          .filter((doc) => (doc.confidence ?? 1) < confidenceThreshold)
          .map((doc) => doc.id)
      }
    },
    {
      checkType: "PARSE_FAILED",
      status: parseFailed ? "ERROR" : "OK",
      details: {
        failedDocumentIds: docs.filter((doc) => doc.status === "FAILED").map((doc) => doc.id)
      }
    }
  ];

  return {
    checks,
    flags: {
      hasPO,
      hasInvoice,
      hasGRN,
      parseFailed,
      lowConfidence,
      duplicateInvoice,
      amountMismatch: amountResult.mismatch,
      qtyMismatch,
      fxMismatch
    }
  };
}
