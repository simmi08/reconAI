import { describe, expect, test } from "vitest";

import { computeState } from "../src/core/reconciliation/stateMachine";

describe("computeState", () => {
  test("returns PARSE_FAILED first", () => {
    expect(
      computeState({
        hasPO: true,
        hasInvoice: true,
        hasGRN: true,
        parseFailed: true,
        lowConfidence: false,
        duplicateInvoice: false,
        fxMismatch: false,
        qtyMismatch: false,
        amountMismatch: false
      })
    ).toBe("PARSE_FAILED");
  });

  test("returns LOW_CONFIDENCE before other issues", () => {
    expect(
      computeState({
        hasPO: true,
        hasInvoice: true,
        hasGRN: true,
        parseFailed: false,
        lowConfidence: true,
        duplicateInvoice: true,
        fxMismatch: true,
        qtyMismatch: true,
        amountMismatch: true
      })
    ).toBe("LOW_CONFIDENCE");
  });

  test("returns DUPLICATE_INVOICE before missing states", () => {
    expect(
      computeState({
        hasPO: false,
        hasInvoice: true,
        hasGRN: false,
        parseFailed: false,
        lowConfidence: false,
        duplicateInvoice: true,
        fxMismatch: false,
        qtyMismatch: false,
        amountMismatch: false
      })
    ).toBe("DUPLICATE_INVOICE");
  });

  test("returns WAITING_FOR_INVOICE when PO + GRN only", () => {
    expect(
      computeState({
        hasPO: true,
        hasInvoice: false,
        hasGRN: true,
        parseFailed: false,
        lowConfidence: false,
        duplicateInvoice: false,
        fxMismatch: false,
        qtyMismatch: false,
        amountMismatch: false
      })
    ).toBe("WAITING_FOR_INVOICE");
  });

  test("returns WAITING_FOR_GOODS_RECEIPT when PO + invoice only", () => {
    expect(
      computeState({
        hasPO: true,
        hasInvoice: true,
        hasGRN: false,
        parseFailed: false,
        lowConfidence: false,
        duplicateInvoice: false,
        fxMismatch: false,
        qtyMismatch: false,
        amountMismatch: false
      })
    ).toBe("WAITING_FOR_GOODS_RECEIPT");
  });

  test("returns MATCHED when all checks pass", () => {
    expect(
      computeState({
        hasPO: true,
        hasInvoice: true,
        hasGRN: true,
        parseFailed: false,
        lowConfidence: false,
        duplicateInvoice: false,
        fxMismatch: false,
        qtyMismatch: false,
        amountMismatch: false
      })
    ).toBe("MATCHED");
  });
});
