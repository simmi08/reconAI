import { NextResponse } from "next/server";

import { uploadFileToRawBucket } from "@/core/supabase/storageClient";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided. Attach at least one file." }, { status: 400 });
    }

    const uploaded: Array<{ fileName: string; objectKey: string; sizeBytes: number }> = [];
    for (const file of files) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const objectKey = await uploadFileToRawBucket(file.name, bytes, file.type || undefined);
      uploaded.push({
        fileName: file.name,
        objectKey,
        sizeBytes: bytes.byteLength
      });
    }

    return NextResponse.json({
      message: "Documents uploaded successfully",
      uploadedCount: uploaded.length,
      uploaded
    });
  } catch (error) {
    console.error("upload-raw failed", error);
    return NextResponse.json(
      { error: "Failed to upload documents" },
      { status: 500 }
    );
  }
}
