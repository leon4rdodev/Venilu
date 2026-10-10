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
  const lastArgsRef = useRef<Args | null>(null);

  const debounced = useCallback(
    (...args: Args) => {
      lastArgsRef.current = args;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        lastArgsRef.current = null;
        callback(...args);
      }, delay);
    },
    [callback, delay],
  );

  // Al desmontar, ejecuta la llamada pendiente en vez de
  // descartarla: teclear y cambiar de sección no pierde cambios.
  // (El cleanup conserva el callback del primer render — para el
  // auto-guardado es funcionalmente idéntico: persiste vía la
  // caché de react-query, sin leer estado del componente.)
  useEffect(
    () => () => {
      if (timeoutRef.current && lastArgsRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
        const args = lastArgsRef.current;
        lastArgsRef.current = null;
        callback(...args);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return debounced;
}
