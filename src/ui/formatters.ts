export function formatDate(value: Date | string | null | undefined): string {
  if (!value) {
    return "-";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toISOString().slice(0, 10);
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) {
    return "-";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toISOString().replace("T", " ").slice(0, 19);
}

export function formatMoney(value: number | string | null | undefined, currency?: string | null): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return "-";
  }
  const prefix = currency ? `${currency} ` : "";
  return `${prefix}${parsed.toFixed(2)}`;
}

export function formatConfidence(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "-";
  }
  return `${(value * 100).toFixed(1)}%`;
}
