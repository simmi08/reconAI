import type { TransactionState } from "@/types/domain";

export type StateInput = {
  hasPO: boolean;
  hasInvoice: boolean;
  hasGRN: boolean;
  parseFailed: boolean;
  lowConfidence: boolean;
  duplicateInvoice: boolean;
  fxMismatch: boolean;
  qtyMismatch: boolean;
  amountMismatch: boolean;
};

export function computeState(input: StateInput): TransactionState {
  if (input.parseFailed) {
    return "PARSE_FAILED";
  }

  if (input.lowConfidence) {
    return "LOW_CONFIDENCE";
  }

  if (input.duplicateInvoice) {
    return "DUPLICATE_INVOICE";
  }

  if (!input.hasPO && (input.hasInvoice || input.hasGRN)) {
    return "WAITING_FOR_PO";
  }

  if (input.hasPO && !input.hasInvoice && !input.hasGRN) {
    return "WAITING_FOR_INVOICE_AND_GRN";
  }

  if (input.hasPO && input.hasGRN && !input.hasInvoice) {
    return "WAITING_FOR_INVOICE";
  }

  if (input.hasPO && input.hasInvoice && !input.hasGRN) {
    return "WAITING_FOR_GOODS_RECEIPT";
  }

  if (input.hasPO && input.hasInvoice && input.hasGRN) {
    if (input.fxMismatch) {
      return "FX_OR_REGION_MISMATCH";
    }
    if (input.qtyMismatch) {
      return "QTY_MISMATCH";
    }
    if (input.amountMismatch) {
      return "AMOUNT_MISMATCH";
    }
    return "MATCHED";
  }

  return "WAITING_FOR_PO";
}
