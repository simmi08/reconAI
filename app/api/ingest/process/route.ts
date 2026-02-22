import { NextRequest, NextResponse } from "next/server";

import { getConfig } from "@/core/config";
import { processPendingDocuments } from "@/core/ingest/pipeline";

export async function POST(request: NextRequest) {
  try {
    const config = getConfig();
    const searchParams = request.nextUrl.searchParams;
    const limit = Number(searchParams.get("limit") ?? config.processBatchSize);
    const retryFailed = searchParams.get("retryFailed") === "1";
    const documentId = searchParams.get("documentId") ?? undefined;

    const summary = await processPendingDocuments({
      limit: Number.isFinite(limit) && limit > 0 ? limit : config.processBatchSize,
      retryFailed,
      documentId
    });

    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process documents" },
      { status: 500 }
    );
  }
}
