"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function IngestControls({ batchSize = 25 }: { batchSize?: number }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>("");
  const router = useRouter();

  async function runAction(type: "scan" | "process") {
    setBusy(true);
    setMessage("");
    try {
      const endpoint =
        type === "scan" ? "/api/ingest/scan" : `/api/ingest/process?limit=${encodeURIComponent(String(batchSize))}`;
      const response = await fetch(endpoint, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Request failed");
      }
      setMessage(JSON.stringify(payload, null, 2));
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => runAction("scan")}
          disabled={busy}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Scan raw folder
        </button>
        <button
          type="button"
          onClick={() => runAction("process")}
          disabled={busy}
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Process batch
        </button>
      </div>
      {message ? <pre className="mt-3 overflow-auto rounded bg-slate-100 p-3 text-xs">{message}</pre> : null}
    </div>
  );
}
