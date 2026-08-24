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
  const startedAtRef = useRef<number>(isLoading ? Date.now() : 0);

  useEffect(() => {
    if (isLoading) {
      startedAtRef.current = Date.now();
      setHoldActive(true);
      return;
    }
    if (!holdActive) return;

    const elapsed = Date.now() - startedAtRef.current;
    const remaining = minMs - elapsed;
    if (remaining <= 0) {
      setHoldActive(false);
      return;
    }
    const timer = setTimeout(() => setHoldActive(false), remaining);
    return () => clearTimeout(timer);
  }, [isLoading, minMs, holdActive]);

  return isLoading || holdActive;
}
