// Cash denominations per currency for the close-shift cash counter.
// Values are ordered from highest to lowest so the count grid reads naturally.

import { round2 } from '@shared/money';

const DENOMINATIONS_BY_CURRENCY: Record<string, readonly number[]> = {
  DOP: [2000, 1000, 500, 200, 100, 50, 25, 10, 5, 1],
  USD: [100, 50, 20, 10, 5, 2, 1, 0.25, 0.10, 0.05, 0.01],
  EUR: [500, 200, 100, 50, 20, 10, 5, 2, 1, 0.50, 0.20, 0.10, 0.05],
  MXN: [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.50],
  COP: [100000, 50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50],
  PEN: [200, 100, 50, 20, 10, 5, 2, 1, 0.50, 0.20, 0.10],
};

/** Generic fallback for currencies without a dedicated denomination set. */
export const GENERIC_DENOMINATIONS: readonly number[] = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

/** Denominations for a given ISO 4217 currency code (falls back to a generic set). */
export function getDenominations(currencyCode: string): readonly number[] {
  return DENOMINATIONS_BY_CURRENCY[currencyCode] ?? GENERIC_DENOMINATIONS;
}

/** Subtotal for one denomination row, rounded to cents to avoid float drift. */
export function denominationSubtotal(denomination: number, quantity: number): number {
  const qty = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 0;
  return round2(denomination * qty);
}

/**
 * Total counted cash from a map of denomination → quantity.
 * Quantities are treated as non-negative integers; invalid entries count as 0.
 */
export function computeCashCountTotal(counts: Record<string, number>): number {
  let total = 0;
  for (const [denomination, quantity] of Object.entries(counts)) {
    total += denominationSubtotal(Number(denomination), quantity);
  }
  return round2(total);
}
