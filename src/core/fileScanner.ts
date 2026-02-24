import crypto from "node:crypto";
import path from "node:path";

import { downloadFromRawBucket, inferMimeType, listRawObjectKeys } from "@/core/supabase/storageClient";
import type { ScanFileResult } from "@/types/domain";

const TEXT_MIME_BY_EXT: Record<string, string> = {
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".pdf": "application/pdf"
};

const IGNORED_FILE_NAMES = new Set([".DS_Store", "Thumbs.db"]);

function toSha256(content: Buffer): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function isIgnoredFile(fileName: string): boolean {
  if (IGNORED_FILE_NAMES.has(fileName)) {
    return true;
  }

  // Ignore hidden OS/editor artifacts and dotfiles in raw dump folders.
  return fileName.startsWith(".");
}

function isIgnoredPath(objectKey: string): boolean {
  const segments = objectKey.split("/").filter(Boolean);
  if (segments.some((segment) => segment.startsWith("."))) {
    return true;
  }
  return segments.some((segment) => IGNORED_FILE_NAMES.has(segment));
}

export async function scanRawDirectory(): Promise<ScanFileResult[]> {
  const objectKeys = await listRawObjectKeys();
  const results: ScanFileResult[] = [];

  for (const objectKey of objectKeys) {
    if (isIgnoredPath(objectKey)) {
      continue;
    }

    const ext = path.extname(objectKey).toLowerCase();
    if (!TEXT_MIME_BY_EXT[ext]) {
      continue;
    }

    const fileName = path.basename(objectKey);
    if (isIgnoredFile(fileName)) {
      continue;
    }

    const bytes = await downloadFromRawBucket(objectKey);
    results.push({
      sourcePath: objectKey,
      fileName: objectKey,
      sizeBytes: bytes.byteLength,
      mimeType: inferMimeType(fileName),
      sha256: toSha256(bytes)
    });
  }

  return results.sort((a, b) => a.fileName.localeCompare(b.fileName));
}

export async function listRawFileNames(): Promise<string[]> {
  const objectKeys = await listRawObjectKeys();
  return objectKeys
    .filter((objectKey) => !isIgnoredPath(objectKey))
    .filter((objectKey) => Boolean(TEXT_MIME_BY_EXT[path.extname(objectKey).toLowerCase()]))
    .sort((a, b) => a.localeCompare(b));
}
