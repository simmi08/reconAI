import path from "node:path";

export function sanitizeKey(input: string): string {
  return input.replace(/[^A-Za-z0-9_-]/g, "_");
}

export function getTransactionStoragePrefix(transactionKey: string): string {
  return path.posix.join("transactions", sanitizeKey(transactionKey));
}
