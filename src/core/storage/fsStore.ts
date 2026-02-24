import path from "node:path";

import {
  downloadFromRawBucket,
  inferMimeType,
  toStorageObjectKey,
  uploadToStorageBucket
} from "@/core/supabase/storageClient";
import { getTransactionStoragePrefix } from "@/core/storage/paths";

export async function syncDocumentArtifacts(params: {
  transactionKey: string;
  sourcePath: string;
  fileName: string;
  documentId: string;
  extractedJson: unknown;
}): Promise<void> {
  const { transactionKey, sourcePath, fileName, documentId, extractedJson } = params;
  const transactionPrefix = getTransactionStoragePrefix(transactionKey);

  const rawBytes = await downloadFromRawBucket(sourcePath);
  await uploadToStorageBucket({
    objectKey: toStorageObjectKey(path.posix.join(transactionPrefix, "docs", fileName)),
    body: rawBytes,
    contentType: inferMimeType(fileName)
  });

  await uploadToStorageBucket({
    objectKey: toStorageObjectKey(path.posix.join(transactionPrefix, "extracted", `${documentId}.json`)),
    body: JSON.stringify(extractedJson, null, 2),
    contentType: "application/json"
  });
}

export async function writeTransactionRollup(
  transactionKey: string,
  payload: Record<string, unknown>
): Promise<void> {
  const transactionPrefix = getTransactionStoragePrefix(transactionKey);
  await uploadToStorageBucket({
    objectKey: toStorageObjectKey(path.posix.join(transactionPrefix, "transaction.json")),
    body: JSON.stringify(payload, null, 2),
    contentType: "application/json"
  });
}

