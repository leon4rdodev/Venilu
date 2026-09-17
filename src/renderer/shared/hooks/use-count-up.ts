import { useState, useEffect, useRef } from 'react';

interface UseCountUpOptions {
  duration?: number;
  delay?: number;
  decimals?: number;
}

/**
 * Hook that animates a number counting up from 0 to the target value.
 * Returns the current animated value.
 */
export function useCountUp(
  target: number,
  { duration = 1200, delay = 0, decimals = 0 }: UseCountUpOptions = {}
): number {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const prevTargetRef = useRef(0);

  useEffect(() => {
    // Cancel any ongoing animation
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }

    const startValue = prevTargetRef.current;
    const diff = target - startValue;

    if (diff === 0) {
      // Nothing to animate — sync on the next frame instead of inside the effect
      rafRef.current = requestAnimationFrame(() => setCurrent(target));
      return () => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      };
    }

    const timeoutId = setTimeout(() => {
      startTimeRef.current = null;

      const animate = (timestamp: number) => {
        if (startTimeRef.current === null) {
          startTimeRef.current = timestamp;
        }

        const elapsed = timestamp - startTimeRef.current;
        const progress = Math.min(elapsed / duration, 1);

        // Ease-out cubic for smooth deceleration
        const eased = 1 - Math.pow(1 - progress, 3);

        const value = startValue + diff * eased;
        const factor = Math.pow(10, decimals);
        setCurrent(Math.round(value * factor) / factor);

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animate);
        } else {
          setCurrent(target);
          prevTargetRef.current = target;
        }
      };

      rafRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [target, duration, delay, decimals]);

  // Update prev target on unmount / final
  useEffect(() => {
    return () => {
      prevTargetRef.current = 0;
    };
  }, []);

  return current;
}
