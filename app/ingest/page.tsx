import fs from "node:fs/promises";
import path from "node:path";

import { getConfig } from "@/core/config";
import { IngestControls } from "@/ui/components/IngestControls";

export const dynamic = "force-dynamic";

export default async function IngestPage() {
  const config = getConfig();
  const entries = await fs.readdir(config.rawDataDir, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort();

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Raw Data Directory</p>
        <p className="mt-1 rounded bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700">{config.rawDataDir}</p>
      </section>

      <IngestControls batchSize={config.processBatchSize} />

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Files in Raw Folder</h2>
          <span className="text-xs text-slate-500">{files.length} files</span>
        </div>
        <ul className="mt-3 max-h-[520px] space-y-1 overflow-auto rounded border border-slate-100 p-2 font-mono text-xs">
          {files.map((file) => (
            <li key={file} className="rounded px-2 py-1 hover:bg-slate-50">
              {path.basename(file)}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
