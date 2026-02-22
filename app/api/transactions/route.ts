import { NextRequest, NextResponse } from "next/server";

import { listTransactions } from "@/db/queries";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rows = await listTransactions({
    state: params.get("state") ?? undefined,
    vendor: params.get("vendor") ?? undefined,
    country: params.get("country") ?? undefined,
    currency: params.get("currency") ?? undefined,
    q: params.get("q") ?? undefined
  });

  return NextResponse.json({ items: rows, count: rows.length });
}
