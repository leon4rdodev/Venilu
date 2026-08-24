/**
 * Money helpers shared between main and renderer.
 * All monetary math in the app should round to 2 decimals to avoid float drift.
 */

/** Round to 2 decimal places (banker-safe enough for POS totals). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** True when the value is a finite number (rejects NaN, Infinity, strings, null). */
export function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Coerce an incoming (untrusted) value to a finite, non-negative money amount
 * rounded to 2 decimals. Returns null when the value is not a valid amount.
 */
export function toMoney(v: unknown): number | null {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (!isFiniteNumber(n as number) || (n as number) < 0) return null;
  return round2(n as number);
}
