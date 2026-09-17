import { useEffect, useRef, useState } from "react";

/**
 * Guarantees a skeleton/loading state stays visible for at least `minMs` once
 * it appears. Local IPC often resolves in ~50ms, which makes skeletons flash
 * awkwardly — holding them briefly makes the transition feel intentional.
 *
 * Returns `true` while either the real loading is active OR the minimum
 * display window hasn't elapsed yet.
 */
export function useMinimumLoading(isLoading: boolean, minMs = 800): boolean {
  const [holdActive, setHoldActive] = useState(isLoading);
  const startedAtRef = useRef<number>(0);

  // When loading (re)starts, arm the hold during render — "reset state on
  // prop change" pattern, no setState inside an effect.
  const [prevLoading, setPrevLoading] = useState(isLoading);
  if (isLoading !== prevLoading) {
    setPrevLoading(isLoading);
    if (isLoading) setHoldActive(true);
  }

  useEffect(() => {
    if (isLoading) {
      startedAtRef.current = Date.now();
      return;
    }
    if (!holdActive) return;
    const remaining = minMs - (Date.now() - startedAtRef.current);
    if (remaining <= 0) {
      // The minimum window already elapsed while loading: release NOW, not on
      // a 0ms timer — a residual tick would flash the skeleton one extra frame.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHoldActive(false);
      return;
    }
    const timer = setTimeout(() => setHoldActive(false), remaining);
    return () => clearTimeout(timer);
  }, [isLoading, minMs, holdActive]);

  return isLoading || holdActive;
}
