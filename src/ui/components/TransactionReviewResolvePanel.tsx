"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ResolutionStatus = {
  notes: string;
  resolvedAt: string;
};

export function TransactionReviewResolvePanel({
  transactionId,
  existingResolution
}: {
  transactionId: string;
  existingResolution: ResolutionStatus | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [localResolution, setLocalResolution] = useState<ResolutionStatus | null>(null);

  const resolved = localResolution ?? existingResolution;

  async function submitResolve() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve-review", notes })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to resolve review");
      }

      setLocalResolution({
        notes: notes.trim(),
        resolvedAt: new Date().toISOString()
      });
      setMessage(payload.message ?? "Manual review marked resolved");
      setOpen(false);
      setNotes("");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to resolve review");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      {resolved ? (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-emerald-700">Manual Review Done</p>
          {resolved.notes ? <p className="text-sm text-slate-700">Comment: {resolved.notes}</p> : null}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setOpen((v) => !v);
              setMessage("");
            }}
            className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
            disabled={busy}
          >
            Start manual review
          </button>
          {message ? <span className="text-xs text-slate-600">{message}</span> : null}
        </div>
      )}

      {!resolved && open ? (
        <div className="mt-3 space-y-2">
          <label htmlFor="resolve-notes" className="text-xs font-medium text-slate-700">
            Comment
          </label>
          <textarea
            id="resolve-notes"
            className="w-full rounded-md border border-slate-300 p-2 text-sm"
            rows={3}
            placeholder="Add resolution notes for audit trail"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={busy}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              onClick={submitResolve}
              disabled={busy}
            >
              Submit
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
