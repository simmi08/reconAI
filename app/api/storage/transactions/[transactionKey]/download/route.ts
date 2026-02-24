import { NextResponse } from "next/server";

import { sanitizeKey } from "@/core/storage/paths";
import {
  downloadFromStorageBucket,
  listStorageObjectsForTransaction
} from "@/core/supabase/storageClient";
import { buildTarArchive } from "@/core/supabase/tar";

export const runtime = "nodejs";

export async function GET(_: Request, context: { params: Promise<{ transactionKey: string }> }) {
  try {
    const { transactionKey } = await context.params;
    const sanitizedKey = sanitizeKey(transactionKey);

    let listing = await listStorageObjectsForTransaction(sanitizedKey);
    if (listing.objectKeys.length === 0 && sanitizedKey !== transactionKey) {
      listing = await listStorageObjectsForTransaction(transactionKey);
    }

    if (listing.objectKeys.length === 0) {
      return NextResponse.json(
        { error: `No processed files found for transaction '${transactionKey}'.` },
        { status: 404 }
      );
    }

    const files = await Promise.all(
      listing.objectKeys.map(async (objectKey) => {
        const content = await downloadFromStorageBucket(objectKey);
        const relativePath = objectKey.startsWith(`${listing.basePrefix}/`)
          ? objectKey.slice(listing.basePrefix.length + 1)
          : objectKey;
        return {
          path: `transactions/${sanitizeKey(transactionKey)}/${relativePath}`,
          content
        };
      })
    );

    const archive = buildTarArchive(files);
    const fileName = `${sanitizeKey(transactionKey)}-processed.tar`;

    const archiveBytes = Uint8Array.from(archive);
    return new NextResponse(new Blob([archiveBytes.buffer], { type: "application/x-tar" }), {
      headers: {
        "Content-Type": "application/x-tar",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(archive.byteLength),
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    console.error("transaction download failed", error);
    return NextResponse.json(
      { error: "Failed to build transaction archive" },
      { status: 500 }
    );
  }
}
