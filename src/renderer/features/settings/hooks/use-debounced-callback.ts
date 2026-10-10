import { useCallback, useEffect, useRef } from "react";

/**
 * Envuelve `callback` con un debounce: se invoca `delay` ms después de
 * la última llamada (y se cancela la pendiente al desmontar).
 *
 * Sirve para persistir ajustes de texto mientras se escribe, sin
 * disparar una petición por tecla.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  delay: number,
): (...args: Args) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debounced = useCallback(
    (...args: Args) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        callback(...args);
      }, delay);
    },
    [callback, delay],
  );

  // Cancela la llamada pendiente si el componente se desmonta
  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  return debounced;
}
