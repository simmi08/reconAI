import { NextRequest, NextResponse } from "next/server";

import { rerunExtractionForDocument } from "@/core/ingest/pipeline";
import {
  createAuditEvent,
  getTransactionAuditEvents,
  getTransactionById,
  getTransactionChecks,
  getTransactionDocs,
  resolveManualReviewByDocument,
  resolveManualReviewsByTransaction
} from "@/db/queries";

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const transaction = await getTransactionById(id);

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  const [docs, checks, events] = await Promise.all([
    getTransactionDocs(id),
    getTransactionChecks(id),
    getTransactionAuditEvents(id)
  ]);

  return NextResponse.json({ transaction, docs, checks, events });
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const action = typeof body.action === "string" ? body.action : "";
  const documentId = typeof body.documentId === "string" ? body.documentId : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";

  const transaction = await getTransactionById(id);
  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  if (action === "rerun") {
    if (!documentId) {
      return NextResponse.json({ error: "documentId is required for rerun action" }, { status: 400 });
    }
    const summary = await rerunExtractionForDocument(documentId);
    await createAuditEvent({
      transactionId: id,
      documentId,
      eventType: "INGESTED",
      message: "Re-run extraction requested from transaction detail",
      meta: { summary }
    });
    return NextResponse.json({ message: "Re-run complete", summary });
  }

  if (action === "resolve-review") {
    const resolvedCount = documentId
      ? await resolveManualReviewByDocument(documentId)
      : await resolveManualReviewsByTransaction(id, notes);

    await createAuditEvent({
      transactionId: id,
      documentId: documentId || undefined,
      eventType: "STATE_UPDATED",
      message: "Manual review resolved",
      meta: { resolvedCount, notes }
    });

    return NextResponse.json({ message: "Manual review marked resolved", resolvedCount });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
