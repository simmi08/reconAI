import Link from "next/link";

import { getConfig } from "@/core/config";
import { getReportsSummary } from "@/db/queries";
import { KpiCard } from "@/ui/components/KpiCard";
import { IngestControls } from "@/ui/components/IngestControls";
import { StateBadge } from "@/ui/components/StateBadge";
import { formatDateTime } from "@/ui/formatters";

export const dynamic = "force-dynamic";

function renderIssueSummary(state: string): string {
  switch (state) {
    case "MATCHED":
      return "No action required";
    case "WAITING_FOR_PO":
      return "Missing PO document";
    case "WAITING_FOR_INVOICE":
      return "Missing invoice document";
    case "WAITING_FOR_GOODS_RECEIPT":
      return "Missing GRN document";
    case "WAITING_FOR_INVOICE_AND_GRN":
      return "Missing invoice and GRN";
    case "DUPLICATE_INVOICE":
      return "Duplicate invoice number";
    case "AMOUNT_MISMATCH":
      return "Invoice and PO amounts differ";
    case "QTY_MISMATCH":
      return "Partial or mismatched quantity";
    case "FX_OR_REGION_MISMATCH":
      return "Country/currency mismatch";
    case "LOW_CONFIDENCE":
      return "Low extraction confidence";
    case "PARSE_FAILED":
      return "Document parsing failed";
    default:
      return "Pending review";
  }
}

export default async function DashboardPage() {
  const reports = await getReportsSummary();
  const config = getConfig();

  const maxCount = Math.max(1, ...reports.stateBreakdown.map((row) => row.count));

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Total Docs" value={reports.kpis.totalDocs} />
        <KpiCard title="Processed Docs" value={reports.kpis.processedDocs} />
        <KpiCard title="Transactions" value={reports.kpis.totalTransactions} />
        <KpiCard title="Exceptions" value={reports.kpis.exceptions} subtitle="State != MATCHED" />
      </section>

      <IngestControls batchSize={config.processBatchSize} />

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">State Breakdown</h2>
          <div className="mt-4 space-y-2">
            {reports.stateBreakdown.map((row) => (
              <div key={row.state} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <StateBadge state={row.state} />
                  <span className="text-slate-600">{row.count}</span>
                </div>
                <div className="h-2 rounded bg-slate-100">
                  <div
                    className="h-2 rounded bg-blue-600"
                    style={{ width: `${Math.max(5, (row.count / maxCount) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Quick Navigation</h2>
          <div className="mt-3 grid gap-2 text-sm">
            <Link className="rounded border border-slate-200 px-3 py-2 hover:bg-slate-50" href="/ingest">
              Ingest raw files
            </Link>
            <Link className="rounded border border-slate-200 px-3 py-2 hover:bg-slate-50" href="/documents">
              Browse extracted documents
            </Link>
            <Link className="rounded border border-slate-200 px-3 py-2 hover:bg-slate-50" href="/transactions">
              Investigate transactions
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Exception Queue (Top 20)</h2>
        <div className="mt-3 overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="px-2 py-2">Transaction Key</th>
                <th className="px-2 py-2">Vendor</th>
                <th className="px-2 py-2">State</th>
                <th className="px-2 py-2">Issue Summary</th>
                <th className="px-2 py-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {reports.exceptionQueue.map((row) => (
                <tr key={row.id} className="border-b border-slate-100">
                  <td className="px-2 py-2 font-medium">
                    <Link href={`/transactions/${row.id}`} className="text-blue-700 hover:underline">
                      {row.transactionKey}
                    </Link>
                  </td>
                  <td className="px-2 py-2">{row.vendorName ?? "-"}</td>
                  <td className="px-2 py-2">
                    <StateBadge state={row.state} />
                  </td>
                  <td className="px-2 py-2">{renderIssueSummary(row.state)}</td>
                  <td className="px-2 py-2 text-slate-600">{formatDateTime(row.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
