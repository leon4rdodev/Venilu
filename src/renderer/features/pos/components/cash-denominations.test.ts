import { describe, it, expect } from 'vitest';
import {
  getDenominations,
  denominationSubtotal,
  computeCashCountTotal,
  GENERIC_DENOMINATIONS,
} from './cash-denominations';

describe('getDenominations', () => {
  it('returns the DOP set ordered from highest to lowest', () => {
    expect(getDenominations('DOP')).toEqual([2000, 1000, 500, 200, 100, 50, 25, 10, 5, 1]);
  });

  it('includes coin fractions for USD and EUR', () => {
    expect(getDenominations('USD')).toContain(0.01);
    expect(getDenominations('EUR')).toContain(0.05);
  });

  it('falls back to the generic set for unknown currencies', () => {
    expect(getDenominations('ARS')).toEqual(GENERIC_DENOMINATIONS);
    expect(getDenominations('XYZ')).toEqual(GENERIC_DENOMINATIONS);
  });
});

describe('denominationSubtotal', () => {
  it('multiplies denomination by quantity', () => {
    expect(denominationSubtotal(500, 3)).toBe(1500);
  });

  it('rounds float drift to cents', () => {
    // 0.10 * 3 === 0.30000000000000004 in raw floats
    expect(denominationSubtotal(0.10, 3)).toBe(0.3);
  });

  it('treats negative, NaN and fractional quantities safely', () => {
    expect(denominationSubtotal(100, -2)).toBe(0);
    expect(denominationSubtotal(100, NaN)).toBe(0);
    expect(denominationSubtotal(100, 2.9)).toBe(200);
  });
});

describe('computeCashCountTotal', () => {
  it('sums all denomination subtotals', () => {
    const total = computeCashCountTotal({ '2000': 2, '500': 3, '25': 4, '1': 7 });
    expect(total).toBe(4000 + 1500 + 100 + 7);
  });

  it('returns 0 for an empty count', () => {
    expect(computeCashCountTotal({})).toBe(0);
  });

  it('keeps cent precision with coin denominations', () => {
    // USD: 3 dimes + 1 nickel + 2 pennies = 0.37
    const total = computeCashCountTotal({ '0.1': 3, '0.05': 1, '0.01': 2 });
    expect(total).toBe(0.37);
  });

  it('ignores invalid quantities', () => {
    const total = computeCashCountTotal({ '100': NaN, '50': 2 });
    expect(total).toBe(100);
  });
});
