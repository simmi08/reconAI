"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TransactionDetailActions({
  transactionId,
  documentId
}: {
  transactionId: string;
  documentId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function callAction(action: "rerun") {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, documentId })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Action failed");
      }
      setMessage(payload.message ?? "Done");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className="rounded border border-slate-300 px-2 py-1 text-xs"
        disabled={busy}
        onClick={() => callAction("rerun")}
      >
        Re-run extraction
      </button>
      {message ? <span className="text-xs text-slate-600">{message}</span> : null}
    </div>
  );
}
