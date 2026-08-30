const inrCompact = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1,
});

const inrDetailed = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatInr(value: number, detailed = false): string {
  return (detailed ? inrDetailed : inrCompact).format(value).replace("T", "L");
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizedKey(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en-IN");
}

export function titleCase(value: string): string {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

export function isoDate(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function startOfQuarter(reference = new Date()): Date {
  const month = Math.floor(reference.getUTCMonth() / 3) * 3;
  return new Date(Date.UTC(reference.getUTCFullYear(), month, 1));
}

export function endOfQuarter(reference = new Date()): Date {
  const start = startOfQuarter(reference);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 0, 23, 59, 59, 999));
}

export function isWithin(value: Date | null, start: Date, end: Date): boolean {
  return value !== null && value >= start && value <= end;
}

export function daysBetween(later: Date, earlier: Date): number {
  return Math.floor((later.getTime() - earlier.getTime()) / 86_400_000);
}

export function stableId(prefix: string, value: string): string {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}
