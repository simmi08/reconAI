"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DocumentRetryAction({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function retry() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        `/api/ingest/process?documentId=${encodeURIComponent(documentId)}&retryFailed=1&limit=1`,
        { method: "POST" }
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Retry failed");
      }
      setMessage(payload.processed > 0 ? "Retried" : payload.message ?? "No change");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Retry failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={retry}
        disabled={busy}
        className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
      >
        Retry processing
      </button>
      {message ? <span className="text-xs text-slate-600">{message}</span> : null}
    </div>
  );
}

