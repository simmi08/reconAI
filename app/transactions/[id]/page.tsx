import { notFound } from "next/navigation";

import {
  getTransactionAuditEvents,
  getTransactionById,
  getTransactionChecks,
  getTransactionDocs,
  getLatestManualReviewResolution
} from "@/db/queries";
import { Badge } from "@/ui/components/Badge";
import { DetailTabs } from "@/ui/components/DetailTabs";
import { JsonViewer } from "@/ui/components/JsonViewer";
import { StateBadge } from "@/ui/components/StateBadge";
import { TransactionDetailActions } from "@/ui/components/TransactionDetailActions";
import { TransactionReviewResolvePanel } from "@/ui/components/TransactionReviewResolvePanel";
import { formatDateTime } from "@/ui/formatters";

export const dynamic = "force-dynamic";

function issueTitleForCheck(checkType: string, status: string): string {
  if (status === "OK") {
    return "";
  }

  switch (checkType) {
    case "PO_PRESENT":
      return "Missing PO";
    case "INVOICE_PRESENT":
      return "Missing invoice";
    case "GRN_PRESENT":
      return "Missing GRN";
    case "AMOUNT_MATCH":
      return "Amount mismatch";
    case "QUANTITY_MATCH":
      return "Quantity mismatch";
    case "DUPLICATE_INVOICE":
      return "Duplicate invoice";
    case "FX_OR_REGION_MATCH":
      return "FX/region mismatch";
    case "LOW_CONFIDENCE":
      return "Low confidence";
    case "PARSE_FAILED":
      return "Parse failure";
    default:
      return checkType;
  }
}

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [transaction, docs, checks, events, latestResolution] = await Promise.all([
    getTransactionById(id),
    getTransactionDocs(id),
    getTransactionChecks(id),
    getTransactionAuditEvents(id),
    getLatestManualReviewResolution(id)
  ]);

  if (!transaction) {
    notFound();
  }

  const issues = checks.filter((check) => check.status !== "OK" && check.status !== "PENDING");

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold text-slate-900">Transaction {transaction.transactionKey}</h1>
          <StateBadge state={transaction.state} />
        </div>
        <p className="mt-1 text-sm text-slate-600">
          Vendor: {transaction.vendorName ?? "-"} | Country: {transaction.country ?? "-"} | Currency: {transaction.currency ?? "-"}
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">What&apos;s missing / what&apos;s wrong</h2>
        {issues.length === 0 ? (
          <p className="mt-2 text-sm text-emerald-700">No blocking issues found.</p>
        ) : (
          <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
            {issues.map((issue) => (
              <li key={`${issue.checkType}-${issue.id}`}>{issueTitleForCheck(issue.checkType, issue.status)}</li>
            ))}
          </ul>
        )}
      </section>

      <TransactionReviewResolvePanel
        transactionId={transaction.id}
        existingResolution={
          latestResolution
            ? {
                notes: latestResolution.notes,
                resolvedAt: latestResolution.createdAt.toISOString()
              }
            : null
        }
      />

      <DetailTabs
        documents={
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="px-2 py-2">File</th>
                  <th className="px-2 py-2">Role</th>
                  <th className="px-2 py-2">Type</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Confidence</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc, index) => (
                  <tr key={`${doc.documentId}-${index}`} className="border-b border-slate-100">
                    <td className="px-2 py-2 font-medium">{doc.fileName}</td>
                    <td className="px-2 py-2">{doc.role}</td>
                    <td className="px-2 py-2">{doc.docType}</td>
                    <td className="px-2 py-2">
                      <Badge tone={doc.status === "FAILED" ? "danger" : doc.status === "PROCESSED" ? "success" : "warning"}>
                        {doc.status}
                      </Badge>
                    </td>
                    <td className="px-2 py-2">{doc.confidence != null ? `${(doc.confidence * 100).toFixed(1)}%` : "-"}</td>
                    <td className="px-2 py-2">
                      <TransactionDetailActions transactionId={transaction.id} documentId={doc.documentId} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
        extracted={
          <div className="space-y-4">
            {docs.map((doc, index) => (
              <div key={`${doc.documentId}-${index}`}>
                <p className="mb-1 text-xs font-semibold uppercase text-slate-500">
                  {doc.fileName} ({doc.docType})
                </p>
                <JsonViewer data={doc.extractedJson ?? {}} />
              </div>
            ))}
          </div>
        }
        checks={
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="px-2 py-2">Check</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Details</th>
                </tr>
              </thead>
              <tbody>
                {checks.map((check, index) => (
                  <tr key={`${check.id}-${index}`} className="border-b border-slate-100">
                    <td className="px-2 py-2 font-medium">{check.checkType}</td>
                    <td className="px-2 py-2">
                      <Badge
                        tone={
                          check.status === "OK"
                            ? "success"
                            : check.status === "PENDING"
                              ? "warning"
                              : check.status === "ERROR"
                                ? "danger"
                                : "danger"
                        }
                      >
                        {check.status}
                      </Badge>
                    </td>
                    <td className="px-2 py-2">
                      <JsonViewer data={check.details} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
        timeline={
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="px-2 py-2">When</th>
                  <th className="px-2 py-2">Event</th>
                  <th className="px-2 py-2">Message</th>
                  <th className="px-2 py-2">Meta</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event, index) => (
                  <tr key={`${event.id}-${index}`} className="border-b border-slate-100">
                    <td className="px-2 py-2 text-slate-600">{formatDateTime(event.createdAt)}</td>
                    <td className="px-2 py-2">{event.eventType}</td>
                    <td className="px-2 py-2">{event.message}</td>
                    <td className="px-2 py-2">
                      <JsonViewer data={event.meta} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
      />
    </div>
  );
}
