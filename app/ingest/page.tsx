import { getConfig } from "@/core/config";
import { listRawFileNames } from "@/core/fileScanner";
import { IngestControls } from "@/ui/components/IngestControls";

export const dynamic = "force-dynamic";

export default async function IngestPage() {
  const config = getConfig();
  const files = await listRawFileNames();

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-900">Document Source</p>
        <p className="mt-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">Connected and ready</p>
      </section>

      <IngestControls batchSize={config.processBatchSize} supabaseUploadEnabled />

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Files in Source</h2>
          <span className="text-xs text-slate-500">{files.length} files</span>
        </div>
        <ul className="mt-3 max-h-[520px] space-y-1 overflow-auto rounded border border-slate-100 p-2 font-mono text-xs">
          {files.map((file) => (
            <li key={file} className="rounded px-2 py-1 hover:bg-slate-50">
              {file}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
