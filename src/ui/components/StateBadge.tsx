import { Badge } from "@/ui/components/Badge";

const toneByState: Record<string, "neutral" | "success" | "warning" | "danger" | "info"> = {
  MATCHED: "success",
  WAITING_FOR_PO: "warning",
  WAITING_FOR_INVOICE: "warning",
  WAITING_FOR_GOODS_RECEIPT: "warning",
  WAITING_FOR_INVOICE_AND_GRN: "warning",
  DUPLICATE_INVOICE: "danger",
  AMOUNT_MISMATCH: "danger",
  QTY_MISMATCH: "danger",
  FX_OR_REGION_MISMATCH: "danger",
  LOW_CONFIDENCE: "info",
  PARSE_FAILED: "danger",
  READY_TO_RECONCILE: "info"
};

export function StateBadge({ state }: { state: string }) {
  return <Badge tone={toneByState[state] ?? "neutral"}>{state}</Badge>;
}
