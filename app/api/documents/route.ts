import { NextRequest, NextResponse } from "next/server";

import { getConfig } from "@/core/config";
import { listDocuments } from "@/db/queries";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const config = getConfig();

  const status = params.get("status") ?? undefined;
  const docType = params.get("docType") ?? undefined;
  const q = params.get("q") ?? undefined;
  const confidenceBelow = params.get("confidenceBelow")
    ? Number(params.get("confidenceBelow"))
    : params.get("lowConfidence") === "1"
      ? config.confidenceThreshold
      : undefined;

  const rows = await listDocuments({
    status,
    docType,
    q,
    confidenceBelow: confidenceBelow && Number.isFinite(confidenceBelow) ? confidenceBelow : undefined
  });

  return NextResponse.json({ items: rows, count: rows.length });
}
