import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

import type { ExtractedDocument } from "@/types/domain";

export const documentStatusEnum = pgEnum("document_status", ["NEW", "PROCESSED", "FAILED", "SKIPPED"]);
export const documentTypeEnum = pgEnum("document_type", [
  "PURCHASE_ORDER",
  "INVOICE",
  "GOODS_RECEIPT",
  "OTHER",
  "UNKNOWN"
]);

export const transactionStateEnum = pgEnum("transaction_state", [
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
]);

export const transactionDocumentRoleEnum = pgEnum("transaction_document_role", ["PO", "INVOICE", "GRN", "OTHER"]);

export const reconciliationCheckTypeEnum = pgEnum("reconciliation_check_type", [
  "PO_PRESENT",
  "INVOICE_PRESENT",
  "GRN_PRESENT",
  "AMOUNT_MATCH",
  "QUANTITY_MATCH",
  "DUPLICATE_INVOICE",
  "FX_OR_REGION_MATCH",
  "LOW_CONFIDENCE",
  "PARSE_FAILED"
]);

export const reconciliationCheckStatusEnum = pgEnum("reconciliation_check_status", [
  "OK",
  "MISSING",
  "MISMATCH",
  "PENDING",
  "ERROR"
]);

export const auditEventTypeEnum = pgEnum("audit_event_type", [
  "DISCOVERED",
  "INGESTED",
  "EXTRACTED",
  "ROUTED",
  "STATE_UPDATED",
  "RECONCILED",
  "MANUAL_REVIEW_REQUIRED",
  "ERROR"
]);

export const manualReviewStatusEnum = pgEnum("manual_review_status", ["OPEN", "RESOLVED"]);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourcePath: text("source_path").notNull(),
    fileName: text("file_name").notNull(),
    sha256: text("sha256").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes").notNull(),
    status: documentStatusEnum("status").notNull().default("NEW"),
    docType: documentTypeEnum("doc_type").notNull().default("UNKNOWN"),
    confidence: real("confidence"),
    extractedJson: jsonb("extracted_json").$type<ExtractedDocument | null>(),
    rawText: text("raw_text"),
    errorMessage: text("error_message"),
    poNumber: text("po_number"),
    invoiceNumber: text("invoice_number"),
    grnNumber: text("grn_number"),
    vendorName: text("vendor_name"),
    vendorId: text("vendor_id"),
    country: text("country"),
    currency: text("currency"),
    docDate: date("doc_date", { mode: "date" }),
    dueDate: date("due_date", { mode: "date" }),
    totalAmount: numeric("total_amount", { precision: 18, scale: 2 }),
    taxAmount: numeric("tax_amount", { precision: 18, scale: 2 }),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    documentsSha256Unique: uniqueIndex("documents_sha256_unique").on(table.sha256),
    documentsPoNumberIdx: index("documents_po_number_idx").on(table.poNumber),
    documentsInvoiceNumberIdx: index("documents_invoice_number_idx").on(table.invoiceNumber),
    documentsGrnNumberIdx: index("documents_grn_number_idx").on(table.grnNumber),
    documentsVendorStatusTypeIdx: index("documents_vendor_status_type_idx").on(
      table.vendorName,
      table.status,
      table.docType
    )
  })
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionKey: text("transaction_key").notNull(),
    poNumber: text("po_number"),
    vendorName: text("vendor_name"),
    country: text("country"),
    currency: text("currency"),
    state: transactionStateEnum("state").notNull().default("WAITING_FOR_INVOICE_AND_GRN"),
    lastReconciledAt: timestamp("last_reconciled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    transactionsTransactionKeyUnique: uniqueIndex("transactions_transaction_key_unique").on(table.transactionKey),
    transactionsPoNumberIdx: index("transactions_po_number_idx").on(table.poNumber)
  })
);

export const transactionDocuments = pgTable(
  "transaction_documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    role: transactionDocumentRoleEnum("role").notNull(),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    transactionDocumentsUnique: unique("transaction_documents_unique").on(table.transactionId, table.documentId)
  })
);

export const reconciliationChecks = pgTable(
  "reconciliation_checks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    checkType: reconciliationCheckTypeEnum("check_type").notNull(),
    status: reconciliationCheckStatusEnum("status").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    reconciliationChecksTransactionCheckUnique: unique("reconciliation_checks_transaction_check_unique").on(
      table.transactionId,
      table.checkType
    )
  })
);

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  transactionId: uuid("transaction_id").references(() => transactions.id, { onDelete: "set null" }),
  documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
  eventType: auditEventTypeEnum("event_type").notNull(),
  message: text("message").notNull(),
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const manualReviewItems = pgTable("manual_review_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  status: manualReviewStatusEnum("status").notNull().default("OPEN"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true })
});
