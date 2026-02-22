export const DocumentStatusValues = ["NEW", "PROCESSED", "FAILED", "SKIPPED"] as const;
export type DocumentStatus = (typeof DocumentStatusValues)[number];

export const DocumentTypeValues = [
  "PURCHASE_ORDER",
  "INVOICE",
  "GOODS_RECEIPT",
  "OTHER",
  "UNKNOWN"
] as const;
export type DocumentType = (typeof DocumentTypeValues)[number];

export const TransactionStateValues = [
  "WAITING_FOR_PO",
  "WAITING_FOR_INVOICE",
  "WAITING_FOR_GOODS_RECEIPT",
  "WAITING_FOR_INVOICE_AND_GRN",
  "READY_TO_RECONCILE",
  "MATCHED",
  "AMOUNT_MISMATCH",
  "QTY_MISMATCH",
  "DUPLICATE_INVOICE",
  "FX_OR_REGION_MISMATCH",
  "LOW_CONFIDENCE",
  "PARSE_FAILED"
] as const;
export type TransactionState = (typeof TransactionStateValues)[number];

export const TransactionDocumentRoleValues = ["PO", "INVOICE", "GRN", "OTHER"] as const;
export type TransactionDocumentRole = (typeof TransactionDocumentRoleValues)[number];

export const ReconciliationCheckTypeValues = [
  "PO_PRESENT",
  "INVOICE_PRESENT",
  "GRN_PRESENT",
  "AMOUNT_MATCH",
  "QUANTITY_MATCH",
  "DUPLICATE_INVOICE",
  "FX_OR_REGION_MATCH",
  "LOW_CONFIDENCE",
  "PARSE_FAILED"
] as const;
export type ReconciliationCheckType = (typeof ReconciliationCheckTypeValues)[number];

export const ReconciliationCheckStatusValues = ["OK", "MISSING", "MISMATCH", "PENDING", "ERROR"] as const;
export type ReconciliationCheckStatus = (typeof ReconciliationCheckStatusValues)[number];

export const AuditEventTypeValues = [
  "DISCOVERED",
  "INGESTED",
  "EXTRACTED",
  "ROUTED",
  "STATE_UPDATED",
  "RECONCILED",
  "MANUAL_REVIEW_REQUIRED",
  "ERROR"
] as const;
export type AuditEventType = (typeof AuditEventTypeValues)[number];

export const ManualReviewStatusValues = ["OPEN", "RESOLVED"] as const;
export type ManualReviewStatus = (typeof ManualReviewStatusValues)[number];

export type ExtractedLineItem = {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  lineTotal: number | null;
};

export type ExtractedDocument = {
  docType: Exclude<DocumentType, "UNKNOWN">;
  poNumber: string;
  invoiceNumber: string;
  grnNumber: string;
  vendorName: string;
  vendorId: string;
  country: string;
  currency: string;
  docDate: string;
  dueDate: string;
  totalAmount: number | null;
  taxAmount: number | null;
  lineItems: ExtractedLineItem[];
  confidence: number;
  notes: string;
};

export type ScanFileResult = {
  sourcePath: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string | null;
  sha256: string;
};

export type CheckResult = {
  checkType: ReconciliationCheckType;
  status: ReconciliationCheckStatus;
  details: Record<string, unknown>;
};
