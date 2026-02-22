import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";

export async function GET() {
  try {
    const dbPing = await db.execute(sql`select now() as now`);
    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      db: dbPing.rows[0] ?? null
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "health check failed"
      },
      { status: 500 }
    );
  }
}
