// Shared currency context — provides current currency code across the whole app.
// Loads from localStorage for instant availability, then syncs with saved settings.

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ipc } from '@lib/ipc';

const STORAGE_KEY = 'venilu_currency';
const DEFAULT_CURRENCY = 'DOP';

interface CurrencyContextValue {
  currency: string;
  setCurrency: (code: string) => void;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: DEFAULT_CURRENCY,
  setCurrency: () => {},
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<string>(
    () => localStorage.getItem(STORAGE_KEY) || DEFAULT_CURRENCY
  );

  // Sync from saved settings on mount
  useEffect(() => {
    ipc.invoke('settings:get').then((result: any) => {
      if (result?.success && result?.data?.currency) {
        const saved = result.data.currency;
        setCurrencyState(saved);
        localStorage.setItem(STORAGE_KEY, saved);
      }
    }).catch(() => { /* silently fail */ });
  }, []);

  // Listen for settings updates dispatched by BusinessSettings after save
  useEffect(() => {
    const handler = (e: Event) => {
      const code = (e as CustomEvent<string>).detail;
      if (code) {
        setCurrencyState(code);
        localStorage.setItem(STORAGE_KEY, code);
      }
    };
    window.addEventListener('currency-updated', handler);
    return () => window.removeEventListener('currency-updated', handler);
  }, []);

  const setCurrency = (code: string) => {
    setCurrencyState(code);
    localStorage.setItem(STORAGE_KEY, code);
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
