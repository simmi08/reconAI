import Link from "next/link";

import { getConfig } from "@/core/config";
import { listDocuments } from "@/db/queries";
import { Badge } from "@/ui/components/Badge";
import { formatConfidence, formatDateTime } from "@/ui/formatters";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default async function DocumentsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const config = getConfig();

  const status = firstParam(params.status);
  const docType = firstParam(params.docType);
  const q = firstParam(params.q);
  const lowConfidenceOnly = firstParam(params.lowConfidence) === "1";

  const rows = await listDocuments({
    status,
    docType,
    q,
    confidenceBelow: lowConfidenceOnly ? config.confidenceThreshold : undefined
  });

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-lg font-semibold">Documents</h1>
        <p className="text-sm text-slate-600">Filter using query params: status, docType, q, lowConfidence=1</p>
      </section>

      <section className="overflow-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
              <th className="px-2 py-2">File</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Doc Type</th>
              <th className="px-2 py-2">Confidence</th>
              <th className="px-2 py-2">PO</th>
              <th className="px-2 py-2">Invoice</th>
              <th className="px-2 py-2">Vendor</th>
              <th className="px-2 py-2">Processed At</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100">
                <td className="px-2 py-2 font-medium">
                  <Link href={`/transactions?q=${encodeURIComponent(row.poNumber ?? row.invoiceNumber ?? "")}`}>
                    {row.fileName}
                  </Link>
                </td>
                <td className="px-2 py-2">
                  <Badge tone={row.status === "FAILED" ? "danger" : row.status === "PROCESSED" ? "success" : "warning"}>
                    {row.status}
                  </Badge>
                </td>
                <td className="px-2 py-2">{row.docType}</td>
                <td className="px-2 py-2">{formatConfidence(row.confidence)}</td>
                <td className="px-2 py-2">{row.poNumber ?? "-"}</td>
                <td className="px-2 py-2">{row.invoiceNumber ?? "-"}</td>
                <td className="px-2 py-2">{row.vendorName ?? "-"}</td>
                <td className="px-2 py-2 text-slate-600">{formatDateTime(row.processedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
