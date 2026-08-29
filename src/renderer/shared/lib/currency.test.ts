import { describe, it, expect, beforeEach } from "vitest";
import { formatCurrency, getCurrencySymbol, SUPPORTED_CURRENCIES } from "./currency";

const STORAGE_KEY = "venilu_currency";

beforeEach(() => {
  window.localStorage.clear();
});

describe("formatCurrency", () => {
  it("defaults to DOP (RD$) when nothing is stored", () => {
    expect(formatCurrency(1234.5)).toBe("RD$ 1,234.50");
  });

  it("uses the currency stored in localStorage", () => {
    window.localStorage.setItem(STORAGE_KEY, "PEN");
    expect(formatCurrency(10)).toBe("S/ 10.00");
  });

  it("prefers the explicit override over localStorage", () => {
    window.localStorage.setItem(STORAGE_KEY, "PEN");
    expect(formatCurrency(10, "DOP")).toBe("RD$ 10.00");
  });

  it("replaces the ambiguous $ symbol with the ISO code (USD, COP, MXN...)", () => {
    expect(formatCurrency(1500, "USD")).toBe("USD 1,500.00");
    expect(formatCurrency(1500, "MXN")).toBe("MXN 1,500.00");
  });

  it("formats with the locale of the currency (EUR → es-ES separators)", () => {
    // es-ES only groups thousands from 10000 up (CLDR minimumGroupingDigits)
    expect(formatCurrency(12345.5, "EUR")).toBe("€ 12.345,50");
    expect(formatCurrency(1234.5, "EUR")).toBe("€ 1234,50");
  });

  it("always shows two decimals", () => {
    expect(formatCurrency(5, "DOP")).toBe("RD$ 5.00");
    expect(formatCurrency(5.129, "DOP")).toBe("RD$ 5.13");
  });

  it("falls back to the ISO code for unknown currencies", () => {
    expect(formatCurrency(9.5, "XXX")).toBe("XXX 9.50");
  });
});

describe("getCurrencySymbol", () => {
  it("defaults to RD$ without stored currency", () => {
    expect(getCurrencySymbol()).toBe("RD$");
  });

  it("reads the stored currency", () => {
    window.localStorage.setItem(STORAGE_KEY, "GTQ");
    expect(getCurrencySymbol()).toBe("Q");
  });

  it("returns the ISO code instead of the generic $", () => {
    expect(getCurrencySymbol("USD")).toBe("USD");
    expect(getCurrencySymbol("COP")).toBe("COP");
  });

  it("returns distinctive symbols directly", () => {
    expect(getCurrencySymbol("PEN")).toBe("S/");
    expect(getCurrencySymbol("EUR")).toBe("€");
    expect(getCurrencySymbol("BRL")).toBe("R$");
  });

  it("stays consistent with formatCurrency for every supported currency", () => {
    for (const { code } of SUPPORTED_CURRENCIES) {
      const symbol = getCurrencySymbol(code);
      expect(formatCurrency(1, code).startsWith(`${symbol} `)).toBe(true);
    }
  });
});
