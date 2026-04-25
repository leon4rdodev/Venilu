import { useEffect, useRef } from "react";

interface UseBarcodeScannerProps {
  onScan: (barcode: string) => void;
  debounceMs?: number; // Time threshold between keystrokes to be considered a scan (default 50ms)
}

export function useBarcodeScanner({ onScan, debounceMs = 50 }: UseBarcodeScannerProps) {
  const barcodeRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key combinations like Ctrl+C, Alt+F, etc.
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const currentTime = Date.now();
      const timeElapsed = currentTime - lastKeyTimeRef.current;

      // If time between keystrokes is too long, it's human typing, reset the buffer
      // However, we don't clear it on the very first character
      if (timeElapsed > debounceMs && barcodeRef.current.length > 0) {
        barcodeRef.current = "";
      }

      // If the Enter key is pressed
      if (e.key === "Enter") {
        if (barcodeRef.current.length >= 3) {
          // It's a valid scan length (most barcodes are longer, e.g., 8-13 chars)
          // Use setTimeout to ensure any React state updates or active element changes finish
          const scannedCode = barcodeRef.current;
          setTimeout(() => onScan(scannedCode), 0);
          
          // Prevent default to stop form submission/unwanted behavior if focused on an input
          e.preventDefault();
        }
        // Always clear after Enter
        barcodeRef.current = "";
      } else if (e.key.length === 1) {
        // Normal character (length 1 ensures we don't append "Shift", "Backspace", etc.)
        // Some scanners might send 'Enter' as the last key without previous characters if buffer was cleared,
        // so we just append valid characters.
        barcodeRef.current += e.key;
      }

      lastKeyTimeRef.current = currentTime;
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onScan, debounceMs]);
}
