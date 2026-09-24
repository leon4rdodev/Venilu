import { useCallback, useEffect } from 'react';
import { useSettings } from '@renderer/features/settings/hooks/use-settings';

export const UI_SCALE_MIN = 0.75;
export const UI_SCALE_MAX = 1.5;
export const UI_SCALE_STEP = 0.05;
export const UI_SCALE_DEFAULT = 1;

export function clampUiScale(value: number): number {
  const stepped = Math.round(value / UI_SCALE_STEP) * UI_SCALE_STEP;
  return Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, stepped));
}

/** Zoom tipo navegador: aplica el factor a la ventana actual (efecto inmediato). */
function applyScaleToWindow(scale: number): void {
  if (!window.ipcRenderer) return;
  window.ipcRenderer.invoke('app:set-ui-scale', scale).catch(() => {
    /* best-effort: la persistencia ya es la fuente de verdad del próximo arranque */
  });
}

/**
 * Escala de interfaz (zoom tipo navegador) persistida en Ajustes.
 *
 * - El valor vive en settings.ui_scale (DB), así el main process lo vuelve a
 *   aplicar al abrir la app (consistente entre sesiones).
 * - `setUiScale` aplica el zoom al instante y persiste el cambio.
 */
export function useUiScale() {
  const { settings, updateSettings } = useSettings();

  const uiScale =
    typeof settings?.ui_scale === 'number' && Number.isFinite(settings.ui_scale)
      ? Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, settings.ui_scale))
      : UI_SCALE_DEFAULT;

  const setUiScale = useCallback(
    async (scale: number) => {
      const next = clampUiScale(scale);
      applyScaleToWindow(next);
      if (next !== settings?.ui_scale) {
        await updateSettings({ ui_scale: next });
      }
    },
    [settings?.ui_scale, updateSettings],
  );

  return {
    uiScale,
    setUiScale,
    resetScale: () => setUiScale(UI_SCALE_DEFAULT),
  };
}

/**
 * Atajos globales de zoom estilo navegador: Ctrl/Cmd + = aumentar, Ctrl/Cmd +
 * − reducir, Ctrl/Cmd + 0 restablecer al 100%.
 *
 * Montar UNA sola vez (p. ej. en MainLayout) — si varias instancias escucharan,
 * cada pulsación duplicaría el zoom.
 */
export function useUiScaleShortcuts() {
  const { uiScale, setUiScale } = useUiScale();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Solo con Ctrl (o Cmd en macOS), sin Alt: no pisa copiar/pegar ni el
      // escáner (use-barcode-scanner ignora combinaciones con modificadores).
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;

      const zoomIn = e.key === '=' || e.key === '+' || e.key === 'NumpadAdd' || e.key === 'Add';
      const zoomOut = e.key === '-' || e.key === 'NumpadSubtract' || e.key === 'Subtract';
      const reset = e.key === '0' || e.key === 'Numpad0';
      if (!zoomIn && !zoomOut && !reset) return;

      e.preventDefault();
      if (reset) {
        void setUiScale(UI_SCALE_DEFAULT);
      } else {
        void setUiScale(uiScale + (zoomIn ? UI_SCALE_STEP : -UI_SCALE_STEP));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [uiScale, setUiScale]);
}