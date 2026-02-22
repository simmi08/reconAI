export function buildTransactionKey(poNumber: string, sha256: string): string {
  const normalizedPo = poNumber.trim();
  if (normalizedPo) {
    return normalizedPo;
  }
  return `UNKNOWN-${sha256.slice(0, 8).toUpperCase()}`;
}
