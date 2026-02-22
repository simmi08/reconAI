import { NextResponse } from "next/server";

import { getReportsSummary } from "@/db/queries";

export async function GET() {
  const summary = await getReportsSummary();
  return NextResponse.json(summary);
}
