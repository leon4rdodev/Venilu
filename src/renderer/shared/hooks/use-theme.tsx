import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

type Theme = 'dark' | 'light' | 'system';

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: 'system',
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

const resolve = (theme: Theme): 'light' | 'dark' =>
  theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

const applyDomTheme = (theme: Theme) => {
  const root = window.document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(resolve(theme));
};

// Last pointer position — the theme reveal expands from where the user clicked.
let lastPointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

// The reveal that is currently on screen (Chromium suspends hit-testing on the
// captured page while it runs, so clicks during it land on <html>).
let activeTransition: { skipTransition: () => void } | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointerdown',
    (e) => { lastPointer = { x: e.clientX, y: e.clientY }; },
    { capture: true, passive: true },
  );

  // Click rescue: a click swallowed by a running reveal (target = <html>)
  // finishes the animation on the spot and is re-dispatched to whatever is
  // really under the cursor — rapid theme toggling works click-for-click.
  window.addEventListener(
    'click',
    (e) => {
      if (!activeTransition || e.target !== document.documentElement) return;
      activeTransition.skipTransition();
      activeTransition = null;
      const { clientX, clientY } = e;
      requestAnimationFrame(() => {
        const real = document.elementFromPoint(clientX, clientY);
        if (real && real !== document.documentElement && real instanceof HTMLElement) {
          real.click();
        }
      });
    },
    { capture: true },
  );
}

/**
 * Swaps the theme inside a View Transition: the whole screen changes as ONE
 * piece (no per-component patchwork) with a circular reveal growing from the
 * click point. Falls back to an instant swap when the API is unavailable or
 * the user prefers reduced motion.
 */
function transitionTheme(nextTheme: Theme) {
  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => {
      ready: Promise<void>;
      finished: Promise<void>;
      skipTransition: () => void;
    };
  };
  const root = document.documentElement;

  // No-op visual change (e.g. system→light while the system IS light):
  // skip the transition so nothing flashes.
  const currentResolved = root.classList.contains('dark') ? 'dark' : 'light';
  if (resolve(nextTheme) === currentResolved) {
    applyDomTheme(nextTheme);
    return;
  }

  // Silence every per-element CSS transition (hover tweens like
  // transition-colors) while the theme flips — otherwise each component
  // animates its own colors at its own pace and the swap looks patchy.
  // index.css: [data-theme-switching] * { transition: none !important }
  root.setAttribute('data-theme-switching', '');
  const resumeTweens = () => root.removeAttribute('data-theme-switching');

  // NOTE: prefers-reduced-motion is deliberately NOT honored here — the theme
  // reveal is a product signature and desktop Linux often reports "reduce"
  // from a global animations toggle the user never chose for this app.
  if (!doc.startViewTransition) {
    console.warn('[theme] View Transitions API no disponible — cambio instantáneo');
    applyDomTheme(nextTheme);
    // Two frames: the no-transition swap must fully paint before tweens return
    requestAnimationFrame(() => requestAnimationFrame(resumeTweens));
    return;
  }

  const { x, y } = lastPointer;
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );

  // Directional concept — "light is the circle":
  //   → light: the NEW light theme EXPANDS from the click point.
  //   → dark:  the OLD light theme COLLAPSES into the click point,
  //            revealing the dark theme underneath.
  // index.css keys off data-theme-reveal to disable the default cross-fade
  // and put the animated snapshot on top.
  // A reveal already running? Finish it instantly — the new one takes over.
  if (activeTransition) {
    activeTransition.skipTransition();
    activeTransition = null;
  }

  const toDark = resolve(nextTheme) === 'dark';
  root.setAttribute('data-theme-reveal', toDark ? 'collapse' : 'expand');
  const transition = doc.startViewTransition(() => applyDomTheme(nextTheme));
  activeTransition = transition;

  transition.ready
    .then(() => {
      const fullCircle = `circle(${radius}px at ${x}px ${y}px)`;
      const noCircle = `circle(0px at ${x}px ${y}px)`;
      try {
        if (toDark) {
          // Old (light) snapshot shrinks away — accelerating into the point
          root.animate(
            { clipPath: [fullCircle, noCircle] },
            {
              duration: 450,
              easing: 'cubic-bezier(0.55, 0, 0.7, 0.2)',
              pseudoElement: '::view-transition-old(root)',
            },
          );
        } else {
          // New (light) snapshot grows — fast start, soft landing
          root.animate(
            { clipPath: [noCircle, fullCircle] },
            {
              duration: 500,
              easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
              pseudoElement: '::view-transition-new(root)',
            },
          );
        }
      } catch (err) {
        // Circle reveal unavailable — drop the marker so the default
        // cross-fade (index.css, 320ms) takes over instead of a hard cut.
        console.warn('[theme] Revelación circular no soportada, usando fade:', err);
        root.removeAttribute('data-theme-reveal');
      }
    })
    .catch((err) => {
      console.warn('[theme] View Transition omitida:', err);
    });

  transition.finished.finally(() => {
    if (activeTransition === transition) activeTransition = null;
    root.removeAttribute('data-theme-reveal');
    resumeTweens();
  });
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'vite-ui-theme',
  ...props
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const storedTheme = localStorage.getItem(storageKey);
    if (storedTheme) {
      return storedTheme as Theme;
    }
    return defaultTheme;
  });

  // Initial mount + external changes: apply WITHOUT transition
  useEffect(() => {
    applyDomTheme(theme);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    localStorage.setItem(storageKey, newTheme);
    // DOM first (inside the view transition), state after — the effect's
    // re-apply is then a no-op on an already-correct class list.
    transitionTheme(newTheme);
    setThemeState(newTheme);
  }, [storageKey]);

  const value = {
    theme,
    setTheme,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};
