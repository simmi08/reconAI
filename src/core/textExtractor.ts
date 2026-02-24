import path from "node:path";

import { downloadFromRawBucket } from "@/core/supabase/storageClient";

export type TextExtractionResult = {
  text: string;
  method: "raw_text" | "markdown" | "pdf_stub";
};

export async function extractTextFromFile(sourcePath: string): Promise<TextExtractionResult> {
  const ext = path.extname(sourcePath).toLowerCase();
  const bytes = await downloadFromRawBucket(sourcePath);

  if (ext === ".txt") {
    return { text: bytes.toString("utf8"), method: "raw_text" };
  }

  if (ext === ".md") {
    return { text: bytes.toString("utf8"), method: "markdown" };
  }

  if (ext === ".pdf") {
    return {
      text: "[PDF extraction not implemented in MVP. Route to manual review if critical fields are missing.]",
      method: "pdf_stub"
    };
  }

  throw new Error(`Unsupported file extension: ${ext}`);
}
