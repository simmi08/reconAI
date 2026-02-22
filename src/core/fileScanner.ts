import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

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

export async function scanRawDirectory(rawDir: string): Promise<ScanFileResult[]> {
  const entries = await fs.readdir(rawDir, { withFileTypes: true });
  const files = entries.filter((entry) => {
    if (!entry.isFile()) {
      return false;
    }
    if (isIgnoredFile(entry.name)) {
      return false;
    }
    const ext = path.extname(entry.name).toLowerCase();
    return Boolean(TEXT_MIME_BY_EXT[ext]);
  });
  const results: ScanFileResult[] = [];

  for (const file of files) {
    const sourcePath = path.join(rawDir, file.name);
    const stat = await fs.stat(sourcePath);
    const content = await fs.readFile(sourcePath);
    const ext = path.extname(file.name).toLowerCase();
    results.push({
      sourcePath,
      fileName: file.name,
      sizeBytes: stat.size,
      mimeType: TEXT_MIME_BY_EXT[ext] ?? null,
      sha256: toSha256(content)
    });
  }

  return results.sort((a, b) => a.fileName.localeCompare(b.fileName));
}
