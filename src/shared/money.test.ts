import { describe, it, expect } from 'vitest';
import { round2, isFiniteNumber, toMoney } from './money';

describe('round2', () => {
  it('corrige el drift de coma flotante (0.1 + 0.2 = 0.3)', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it('redondea a 2 decimales hacia arriba en el punto medio', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(2.675)).toBe(2.68);
  });

  it('deja intactos los valores ya redondeados', () => {
    expect(round2(10)).toBe(10);
    expect(round2(12.34)).toBe(12.34);
    expect(round2(0)).toBe(0);
  });

  it('redondea 19.999 a 20', () => {
    expect(round2(19.999)).toBe(20);
  });

  it('maneja negativos', () => {
    expect(round2(-1.235)).toBe(-1.23);
    expect(round2(-5.678)).toBe(-5.68);
  });

  it('propaga NaN (la validación es responsabilidad de isFiniteNumber/toMoney)', () => {
    expect(round2(NaN)).toBeNaN();
  });
});

describe('isFiniteNumber', () => {
  it('acepta números finitos', () => {
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(-3.5)).toBe(true);
    expect(isFiniteNumber(1e6)).toBe(true);
  });

  it('rechaza NaN, Infinity y no-números', () => {
    expect(isFiniteNumber(NaN)).toBe(false);
    expect(isFiniteNumber(Infinity)).toBe(false);
    expect(isFiniteNumber(-Infinity)).toBe(false);
    expect(isFiniteNumber('5')).toBe(false);
    expect(isFiniteNumber(null)).toBe(false);
    expect(isFiniteNumber(undefined)).toBe(false);
    expect(isFiniteNumber({})).toBe(false);
  });
});

describe('toMoney', () => {
  it('coerciona strings numéricos y redondea', () => {
    expect(toMoney('12.345')).toBe(12.35);
    expect(toMoney('100')).toBe(100);
  });

  it('acepta números válidos', () => {
    expect(toMoney(0)).toBe(0);
    expect(toMoney(9.999)).toBe(10);
  });

  it('rechaza negativos', () => {
    expect(toMoney(-1)).toBeNull();
    expect(toMoney('-0.01')).toBeNull();
  });

  it('rechaza valores no numéricos', () => {
    expect(toMoney(NaN)).toBeNull();
    expect(toMoney(Infinity)).toBeNull();
    expect(toMoney('')).toBeNull();
    expect(toMoney('   ')).toBeNull();
    expect(toMoney('abc')).toBeNull();
    expect(toMoney(null)).toBeNull();
    expect(toMoney(undefined)).toBeNull();
  });
});
