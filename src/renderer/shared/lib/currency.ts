// Currency formatting utility.
// Uses the currency stored in localStorage (synced from CurrencyProvider).
// Accepts an optional override for one-off calls.

const STORAGE_KEY = 'venilu_currency';
const DEFAULT_CURRENCY = 'DOP';

// Maps ISO 4217 currency code → best-fit locale for LATAM currencies
const CURRENCY_LOCALE_MAP: Record<string, string> = {
  DOP: 'es-DO', // Peso Dominicano
  USD: 'en-US', // Dólar
  MXN: 'es-MX', // Peso Mexicano
  COP: 'es-CO', // Peso Colombiano
  ARS: 'es-AR', // Peso Argentino
  CLP: 'es-CL', // Peso Chileno
  PEN: 'es-PE', // Sol Peruano
  VES: 'es-VE', // Bolívar Venezolano
  GTQ: 'es-GT', // Quetzal Guatemalteco
  CRC: 'es-CR', // Colón Costarricense
  UYU: 'es-UY', // Peso Uruguayo
  PYG: 'es-PY', // Guaraní Paraguayo
  BOB: 'es-BO', // Boliviano
  HNL: 'es-HN', // Lempira Hondureño
  NIO: 'es-NI', // Córdoba Nicaragüense
  PAB: 'es-PA', // Balboa Panameño
  EUR: 'es-ES', // Euro
  BRL: 'pt-BR', // Real Brasileño
};

function getLocale(currencyCode: string): string {
  return CURRENCY_LOCALE_MAP[currencyCode] ?? 'es-DO';
}

export function formatCurrency(amount: number, currencyOverride?: string): string {
  const currency = currencyOverride
    ?? localStorage.getItem(STORAGE_KEY)
    ?? DEFAULT_CURRENCY;

  try {
    const locale = getLocale(currency);
    const currencyInfo = SUPPORTED_CURRENCIES.find(c => c.code === currency);

    // Format just the number with locale-aware separators (commas/dots)
    const number = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);

    // Use the ISO code for generic `$` symbols to avoid ambiguity (USD vs COP vs MXN etc.)
    // For distinctive symbols (RD$, S/, R$, €, ₡, Q…) use the symbol directly
    const symbol = currencyInfo?.symbol === '$' ? currency : (currencyInfo?.symbol ?? currency);

    return `${symbol} ${number}`;
  } catch {
    return `${DEFAULT_CURRENCY} ${amount.toFixed(2)}`;
  }
}

/** Returns just the display prefix for the current currency (e.g. "RD$", "USD", "COP").
 *  Use this for input field labels/prefixes so they stay in sync with formatCurrency. */
export function getCurrencySymbol(currencyOverride?: string): string {
  const currency = currencyOverride
    ?? localStorage.getItem(STORAGE_KEY)
    ?? DEFAULT_CURRENCY;
  const info = SUPPORTED_CURRENCIES.find(c => c.code === currency);
  return info?.symbol === '$' ? currency : (info?.symbol ?? currency);
}


// List of supported currencies for the settings UI
export const SUPPORTED_CURRENCIES = [
  { code: 'DOP', label: 'Peso Dominicano', country: 'República Dominicana', symbol: 'RD$' },
  { code: 'USD', label: 'Dólar Estadounidense', country: 'Estados Unidos / Ecuador / El Salvador / Panamá', symbol: '$' },
  { code: 'MXN', label: 'Peso Mexicano', country: 'México', symbol: '$' },
  { code: 'COP', label: 'Peso Colombiano', country: 'Colombia', symbol: '$' },
  { code: 'ARS', label: 'Peso Argentino', country: 'Argentina', symbol: '$' },
  { code: 'CLP', label: 'Peso Chileno', country: 'Chile', symbol: '$' },
  { code: 'PEN', label: 'Sol', country: 'Perú', symbol: 'S/' },
  { code: 'VES', label: 'Bolívar', country: 'Venezuela', symbol: 'Bs.' },
  { code: 'GTQ', label: 'Quetzal', country: 'Guatemala', symbol: 'Q' },
  { code: 'CRC', label: 'Colón', country: 'Costa Rica', symbol: '₡' },
  { code: 'UYU', label: 'Peso Uruguayo', country: 'Uruguay', symbol: '$U' },
  { code: 'PYG', label: 'Guaraní', country: 'Paraguay', symbol: '₲' },
  { code: 'BOB', label: 'Boliviano', country: 'Bolivia', symbol: 'Bs.' },
  { code: 'HNL', label: 'Lempira', country: 'Honduras', symbol: 'L' },
  { code: 'NIO', label: 'Córdoba', country: 'Nicaragua', symbol: 'C$' },
  { code: 'BRL', label: 'Real', country: 'Brasil', symbol: 'R$' },
  { code: 'EUR', label: 'Euro', country: 'España / Europa', symbol: '€' },
] as const;
