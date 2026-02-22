DO $$ BEGIN
  CREATE TYPE "document_status" AS ENUM ('NEW', 'PROCESSED', 'FAILED', 'SKIPPED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "document_type" AS ENUM ('PURCHASE_ORDER', 'INVOICE', 'GOODS_RECEIPT', 'OTHER', 'UNKNOWN');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "transaction_state" AS ENUM (
    'WAITING_FOR_PO',
    'WAITING_FOR_INVOICE',
    'WAITING_FOR_GOODS_RECEIPT',
    'WAITING_FOR_INVOICE_AND_GRN',
    'READY_TO_RECONCILE',
    'MATCHED',
    'AMOUNT_MISMATCH',
    'QTY_MISMATCH',
    'DUPLICATE_INVOICE',
    'FX_OR_REGION_MISMATCH',
    'LOW_CONFIDENCE',
    'PARSE_FAILED'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "transaction_document_role" AS ENUM ('PO', 'INVOICE', 'GRN', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "reconciliation_check_type" AS ENUM (
    'PO_PRESENT',
    'INVOICE_PRESENT',
    'GRN_PRESENT',
    'AMOUNT_MATCH',
    'QUANTITY_MATCH',
    'DUPLICATE_INVOICE',
    'FX_OR_REGION_MATCH',
    'LOW_CONFIDENCE',
    'PARSE_FAILED'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "reconciliation_check_status" AS ENUM ('OK', 'MISSING', 'MISMATCH', 'PENDING', 'ERROR');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "audit_event_type" AS ENUM (
    'DISCOVERED',
    'INGESTED',
    'EXTRACTED',
    'ROUTED',
    'STATE_UPDATED',
    'RECONCILED',
    'MANUAL_REVIEW_REQUIRED',
    'ERROR'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "manual_review_status" AS ENUM ('OPEN', 'RESOLVED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "source_path" text NOT NULL,
  "file_name" text NOT NULL,
  "sha256" text NOT NULL,
  "mime_type" text,
  "size_bytes" integer NOT NULL,
  "status" document_status NOT NULL DEFAULT 'NEW',
  "doc_type" document_type NOT NULL DEFAULT 'UNKNOWN',
  "confidence" real,
  "extracted_json" jsonb,
  "raw_text" text,
  "error_message" text,
  "po_number" text,
  "invoice_number" text,
  "grn_number" text,
  "vendor_name" text,
  "vendor_id" text,
  "country" text,
  "currency" text,
  "doc_date" date,
  "due_date" date,
  "total_amount" numeric(18,2),
  "tax_amount" numeric(18,2),
  "first_seen_at" timestamptz NOT NULL DEFAULT now(),
  "processed_at" timestamptz,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "documents_sha256_unique" ON "documents" ("sha256");
CREATE INDEX IF NOT EXISTS "documents_po_number_idx" ON "documents" ("po_number");
CREATE INDEX IF NOT EXISTS "documents_invoice_number_idx" ON "documents" ("invoice_number");
CREATE INDEX IF NOT EXISTS "documents_grn_number_idx" ON "documents" ("grn_number");
CREATE INDEX IF NOT EXISTS "documents_vendor_status_type_idx" ON "documents" ("vendor_name", "status", "doc_type");

CREATE TABLE IF NOT EXISTS "transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "transaction_key" text NOT NULL,
  "po_number" text,
  "vendor_name" text,
  "country" text,
  "currency" text,
  "state" transaction_state NOT NULL DEFAULT 'WAITING_FOR_INVOICE_AND_GRN',
  "last_reconciled_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "transactions_transaction_key_unique" ON "transactions" ("transaction_key");
CREATE INDEX IF NOT EXISTS "transactions_po_number_idx" ON "transactions" ("po_number");

CREATE TABLE IF NOT EXISTS "transaction_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "transaction_id" uuid NOT NULL REFERENCES "transactions"("id") ON DELETE CASCADE,
  "document_id" uuid NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
  "role" transaction_document_role NOT NULL,
  "is_primary" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "transaction_documents_unique" UNIQUE ("transaction_id", "document_id")
);

CREATE TABLE IF NOT EXISTS "reconciliation_checks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "transaction_id" uuid NOT NULL REFERENCES "transactions"("id") ON DELETE CASCADE,
  "check_type" reconciliation_check_type NOT NULL,
  "status" reconciliation_check_status NOT NULL,
  "details" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "reconciliation_checks_transaction_check_unique" UNIQUE ("transaction_id", "check_type")
);

CREATE TABLE IF NOT EXISTS "audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "transaction_id" uuid REFERENCES "transactions"("id") ON DELETE SET NULL,
  "document_id" uuid REFERENCES "documents"("id") ON DELETE SET NULL,
  "event_type" audit_event_type NOT NULL,
  "message" text NOT NULL,
  "meta" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "manual_review_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "document_id" uuid NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
  "reason" text NOT NULL,
  "status" manual_review_status NOT NULL DEFAULT 'OPEN',
  "notes" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "resolved_at" timestamptz
);
