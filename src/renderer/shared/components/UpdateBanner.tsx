import { Download, RefreshCw, Rocket, X, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { useUpdater } from '@renderer/shared/hooks/use-updater';

export function UpdateBanner() {
  const { status, updateInfo, progress, installNow } = useUpdater();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (status === 'idle' || status === 'checking' || status === 'up-to-date') return null;

  const isDownloading = status === 'downloading';
  const isReady = status === 'downloaded';
  const isAvailable = status === 'available';

  return (
    <div
      className="fixed bottom-5 right-5 z-50 overflow-hidden rounded-2xl shadow-2xl shadow-black/20"
      style={{ width: 360 }}
    >
      {/* Gradient top bar using primary color */}
      <div className="h-1 w-full bg-primary" />

      <div className="bg-card border border-border/60 rounded-b-2xl px-5 py-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Icon bubble — always primary */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary">
              {isDownloading ? (
                <Download className="h-5 w-5 text-primary-foreground animate-bounce" />
              ) : isReady ? (
                <Rocket className="h-5 w-5 text-primary-foreground" />
              ) : (
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-foreground leading-tight">
                  {isAvailable && 'Nueva versión disponible'}
                  {isDownloading && 'Descargando actualización'}
                  {isReady && '¡Lista para instalar!'}
                </p>
                {isReady && (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wide">
                    Nueva
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Venilu POS{' '}
                <span className="font-semibold text-foreground/70">
                  v{updateInfo?.version}
                </span>
              </p>
            </div>
          </div>

          {!isDownloading && (
            <button
              onClick={() => setDismissed(true)}
              className="mt-0.5 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="mt-3">
          {(isAvailable || isReady) && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {isAvailable
                ? 'Descargando en segundo plano. Te avisaremos cuando esté lista.'
                : 'La actualización ya está descargada. Reinicia la app para aplicarla.'}
            </p>
          )}

          {isDownloading && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Descargando…</span>
                <span className="font-semibold text-foreground">
                  {(progress as any)?.percent ?? 0}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${(progress as any)?.percent ?? 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {isReady && (
          <div className="mt-4 flex gap-2">
            <button
              onClick={installNow}
              className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 active:scale-95"
            >
              Reiniciar e instalar
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              Más tarde
            </button>
          </div>
        )}

        {isAvailable && (
          <div className="mt-3 flex items-center gap-2">
            <RefreshCw
              className="h-3.5 w-3.5 text-muted-foreground animate-spin"
              style={{ animationDuration: '3s' }}
            />
            <span className="text-xs text-muted-foreground">
              Descargando en segundo plano…
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
