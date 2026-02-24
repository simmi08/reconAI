"use client";

import { useState } from "react";

type Props = {
  transactionKey: string;
  enabled?: boolean;
};

export function TransactionStorageDownloadButton({ transactionKey, enabled = false }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function downloadArchive() {
    if (!enabled) {
      setMessage("Processed file download is not configured.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/storage/transactions/${encodeURIComponent(transactionKey)}/download`, {
        method: "GET"
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to download transaction archive");
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = `${transactionKey.replace(/[^A-Za-z0-9_-]/g, "_")}-processed.tar`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to download transaction archive");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={downloadArchive}
        disabled={busy || !enabled}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
      >
        {busy ? "Preparing..." : "Download processed transaction"}
      </button>
      {message ? <span className="text-xs text-slate-600">{message}</span> : null}
    </div>
  );
}
