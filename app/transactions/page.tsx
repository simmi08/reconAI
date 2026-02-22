import Link from "next/link";

import { listTransactions } from "@/db/queries";
import { Badge } from "@/ui/components/Badge";
import { StateBadge } from "@/ui/components/StateBadge";
import { formatDateTime } from "@/ui/formatters";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

export default async function TransactionsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rows = await listTransactions({
    state: firstParam(params.state),
    vendor: firstParam(params.vendor),
    country: firstParam(params.country),
    currency: firstParam(params.currency),
    q: firstParam(params.q)
  });

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-lg font-semibold">Transactions</h1>
        <p className="text-sm text-slate-600">Filter using query params: state, vendor, country, currency, q</p>
      </section>

      <section className="overflow-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
              <th className="px-2 py-2">Transaction Key</th>
              <th className="px-2 py-2">Vendor</th>
              <th className="px-2 py-2">State</th>
              <th className="px-2 py-2">Review</th>
              <th className="px-2 py-2">PO / INV / GRN</th>
              <th className="px-2 py-2">Last Reconciled</th>
              <th className="px-2 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
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
                <td className="px-2 py-2">
                  <Badge tone={row.reviewStatus === "DONE" ? "success" : "warning"}>{row.reviewStatus}</Badge>
                  {row.reviewComment ? <p className="mt-1 text-xs text-slate-500">Comment: {row.reviewComment}</p> : null}
                </td>
                <td className="px-2 py-2">
                  {row.counts.PO}/{row.counts.INVOICE}/{row.counts.GRN}
                </td>
                <td className="px-2 py-2 text-slate-600">{formatDateTime(row.lastReconciledAt)}</td>
                <td className="px-2 py-2 text-slate-600">{formatDateTime(row.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
