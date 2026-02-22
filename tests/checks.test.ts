import { describe, expect, test } from "vitest";

import { detectDuplicateInvoiceNumbers, isAmountMismatch } from "../src/core/reconciliation/checks";

describe("amount tolerance", () => {
  test("flags mismatch when above tolerance", () => {
    const result = isAmountMismatch(100, 103, 0.02);
    expect(result.mismatch).toBe(true);
  });

  test("does not flag mismatch when within tolerance", () => {
    const result = isAmountMismatch(100, 101.5, 0.02);
    expect(result.mismatch).toBe(false);
  });
});

describe("duplicate invoice detection", () => {
  test("detects duplicates case-insensitively", () => {
    expect(detectDuplicateInvoiceNumbers(["INV-1", "inv-1", "INV-2"])).toBe(true);
  });

  test("ignores empty invoice numbers", () => {
    expect(detectDuplicateInvoiceNumbers(["", "  ", "INV-2"])).toBe(false);
  });
});
