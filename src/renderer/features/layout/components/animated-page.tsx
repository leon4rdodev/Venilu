import { ReactNode } from "react";

/**
 * Formerly animated the page entrance; now a pure passthrough so every
 * screen renders instantly. Kept as a component to avoid breaking imports.
 */
export function AnimatedPage({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
