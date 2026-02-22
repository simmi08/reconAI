import { NextResponse } from "next/server";

import { scanAndRegisterDocuments } from "@/core/ingest/pipeline";

export async function POST() {
  try {
    const summary = await scanAndRegisterDocuments();
    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to scan raw directory" },
      { status: 500 }
    );
  }
}
