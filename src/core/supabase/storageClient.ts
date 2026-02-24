import path from "node:path";

import { getConfig } from "@/core/config";

type ListedObject = {
  name: string;
  id: string | null;
};

function getRequiredSupabaseConfig() {
  const config = getConfig();

  return {
    url: config.supabase.url,
    serviceRoleKey: config.supabase.serviceRoleKey,
    rawBucket: config.supabase.rawBucket,
    storageBucket: config.supabase.storageBucket,
    rawPrefix: config.supabase.rawPrefix,
    storagePrefix: config.supabase.storagePrefix
  };
}

function requestHeaders(serviceRoleKey: string, contentType?: string): Record<string, string> {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    ...(contentType ? { "Content-Type": contentType } : {})
  };
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string; error?: string };
    return payload.message ?? payload.error ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

export function joinObjectPath(...segments: string[]): string {
  return segments.map((segment) => segment.replace(/^\/+|\/+$/g, "")).filter(Boolean).join("/");
}

function encodeObjectPath(objectKey: string): string {
  return objectKey
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function inferMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".txt") {
    return "text/plain";
  }
  if (ext === ".md") {
    return "text/markdown";
  }
  if (ext === ".pdf") {
    return "application/pdf";
  }
  if (ext === ".json") {
    return "application/json";
  }
  return "application/octet-stream";
}

async function listPage(params: {
  bucket: string;
  prefix: string;
  limit: number;
  offset: number;
}): Promise<ListedObject[]> {
  const config = getRequiredSupabaseConfig();
  const response = await fetch(`${config.url}/storage/v1/object/list/${encodeURIComponent(params.bucket)}`, {
    method: "POST",
    headers: requestHeaders(config.serviceRoleKey, "application/json"),
    body: JSON.stringify({
      prefix: params.prefix ?? "",
      limit: params.limit,
      offset: params.offset,
      sortBy: { column: "name", order: "asc" }
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Failed to list bucket '${params.bucket}': ${await readErrorMessage(response)}`);
  }

  return (await response.json()) as ListedObject[];
}

async function listAllObjectsRecursive(bucket: string, prefix: string): Promise<string[]> {
  const files: string[] = [];
  const pageSize = 100;
  let offset = 0;

  while (true) {
    const page = await listPage({ bucket, prefix, limit: pageSize, offset });
    if (page.length === 0) {
      break;
    }

    for (const item of page) {
      const key = joinObjectPath(prefix, item.name);
      if (item.id) {
        files.push(key);
      } else {
        const nested = await listAllObjectsRecursive(bucket, key);
        files.push(...nested);
      }
    }

    if (page.length < pageSize) {
      break;
    }
    offset += pageSize;
  }

  return files;
}

export function toRawObjectKey(fileNameOrRelativePath: string): string {
  const config = getRequiredSupabaseConfig();
  return joinObjectPath(config.rawPrefix, fileNameOrRelativePath);
}

export function toStorageObjectKey(relativePath: string): string {
  const config = getRequiredSupabaseConfig();
  return joinObjectPath(config.storagePrefix, relativePath);
}

export async function uploadFileToRawBucket(fileName: string, body: Uint8Array, contentType?: string): Promise<string> {
  const config = getRequiredSupabaseConfig();
  const objectKey = toRawObjectKey(fileName);
  const stableBytes = Uint8Array.from(body);
  const requestBody = new Blob([stableBytes.buffer], { type: contentType ?? inferMimeType(fileName) });
  const response = await fetch(
    `${config.url}/storage/v1/object/${encodeURIComponent(config.rawBucket)}/${encodeObjectPath(objectKey)}`,
    {
      method: "POST",
      headers: {
        ...requestHeaders(config.serviceRoleKey, contentType ?? inferMimeType(fileName)),
        "x-upsert": "true"
      },
      body: requestBody
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to upload '${fileName}' to raw bucket: ${await readErrorMessage(response)}`);
  }

  return objectKey;
}

export async function listRawObjectKeys(): Promise<string[]> {
  const config = getRequiredSupabaseConfig();
  const objectKeys = await listAllObjectsRecursive(config.rawBucket, config.rawPrefix);
  return objectKeys.sort((a, b) => a.localeCompare(b));
}

export async function downloadFromRawBucket(objectKey: string): Promise<Buffer> {
  const config = getRequiredSupabaseConfig();
  const response = await fetch(
    `${config.url}/storage/v1/object/${encodeURIComponent(config.rawBucket)}/${encodeObjectPath(objectKey)}`,
    {
      method: "GET",
      headers: requestHeaders(config.serviceRoleKey),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to download '${objectKey}' from raw bucket: ${await readErrorMessage(response)}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function listStorageObjectsForTransaction(transactionKey: string): Promise<{
  basePrefix: string;
  objectKeys: string[];
}> {
  const config = getRequiredSupabaseConfig();
  const basePrefix = toStorageObjectKey(joinObjectPath("transactions", transactionKey));
  const objectKeys = await listAllObjectsRecursive(config.storageBucket, basePrefix);
  return { basePrefix, objectKeys };
}

export async function uploadToStorageBucket(params: {
  objectKey: string;
  body: Uint8Array | Buffer | string;
  contentType: string;
  upsert?: boolean;
}): Promise<void> {
  const config = getRequiredSupabaseConfig();
  const bytes = typeof params.body === "string" ? Buffer.from(params.body, "utf8") : Uint8Array.from(params.body);
  const requestBody = new Blob([bytes.buffer], { type: params.contentType });
  const response = await fetch(
    `${config.url}/storage/v1/object/${encodeURIComponent(config.storageBucket)}/${encodeObjectPath(params.objectKey)}`,
    {
      method: "POST",
      headers: {
        ...requestHeaders(config.serviceRoleKey, params.contentType),
        "x-upsert": params.upsert === false ? "false" : "true"
      },
      body: requestBody
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to upload '${params.objectKey}' to storage bucket: ${await readErrorMessage(response)}`);
  }
}

export async function downloadFromStorageBucket(objectKey: string): Promise<Buffer> {
  const config = getRequiredSupabaseConfig();
  const response = await fetch(
    `${config.url}/storage/v1/object/${encodeURIComponent(config.storageBucket)}/${encodeObjectPath(objectKey)}`,
    {
      method: "GET",
      headers: requestHeaders(config.serviceRoleKey),
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to download '${objectKey}' from storage bucket: ${await readErrorMessage(response)}`);
  }

  return Buffer.from(await response.arrayBuffer());
}
