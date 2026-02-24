"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export function IngestControls({
  batchSize = 25,
  supabaseUploadEnabled = true
}: {
  batchSize?: number;
  supabaseUploadEnabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const router = useRouter();
  const uploadDisabled = useMemo(
    () => busy || uploadBusy || !supabaseUploadEnabled,
    [busy, uploadBusy, supabaseUploadEnabled]
  );

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

  async function uploadToRawBucket() {
    if (!supabaseUploadEnabled) {
      setMessage("Document upload is not configured.");
      return;
    }

    if (!selectedFiles || selectedFiles.length === 0) {
      setMessage("Select one or more files before upload.");
      return;
    }

    setUploadBusy(true);
    setMessage("");
    try {
      const formData = new FormData();
      for (const file of Array.from(selectedFiles)) {
        formData.append("files", file);
      }

      const response = await fetch("/api/storage/upload-raw", {
        method: "POST",
        body: formData
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Upload failed");
      }

      setMessage(JSON.stringify(payload, null, 2));
      setSelectedFiles(null);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => runAction("scan")}
          disabled={busy || uploadBusy}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Scan for new docs
        </button>
        <button
          type="button"
          onClick={() => runAction("process")}
          disabled={busy || uploadBusy}
          className="rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          Process batch
        </button>
      </div>
      <div className="mt-3 rounded border border-slate-200 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Upload docs</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <input
            type="file"
            multiple
            onChange={(event) => setSelectedFiles(event.target.files)}
            className="max-w-sm rounded border border-slate-300 bg-white px-2 py-1 text-xs"
            disabled={uploadDisabled}
          />
          <button
            type="button"
            onClick={uploadToRawBucket}
            disabled={uploadDisabled}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
          >
            {uploadBusy ? "Uploading..." : "Upload docs"}
          </button>
        </div>
        {!supabaseUploadEnabled ? (
          <p className="mt-2 text-xs text-amber-700">Configure storage credentials to enable upload.</p>
        ) : null}
      </div>
      {message ? <pre className="mt-3 overflow-auto rounded bg-slate-100 p-3 text-xs">{message}</pre> : null}
    </div>
  );
}
