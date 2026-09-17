import { Download, Rocket, X, Sparkles } from 'lucide-react';
import { Skeleton } from '@components/ui/skeleton';
import { useState } from 'react';
import { useUpdater } from '@renderer/shared/hooks/use-updater';

export function UpdateBanner() {
  const { status, updateInfo, progress, installNow, error } = useUpdater();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (status === 'idle' || status === 'checking' || status === 'up-to-date') return null;

  const isDownloading = status === 'downloading';
  const isReady = status === 'downloaded';
  const isAvailable = status === 'available';
  const isError = status === 'error';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Actualización de Venilu"
      className="fixed bottom-5 right-5 z-50 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/20"
      style={{ width: 360 }}
    >
      {/* Gradient top bar using primary color */}
      <div aria-hidden className={`h-1 w-full ${isError ? 'bg-destructive' : 'bg-primary'}`} />

      <div className="px-5 py-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Icon bubble */}
            <div
              aria-hidden
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isError ? 'bg-destructive/10' : 'bg-primary'}`}
            >
              {isDownloading ? (
                <Download className="h-5 w-5 text-primary-foreground animate-bounce motion-reduce:animate-none" />
              ) : isReady ? (
                <Rocket className="h-5 w-5 text-primary-foreground" />
              ) : isError ? (
                <X className="h-5 w-5 text-destructive" />
              ) : (
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className={`text-sm font-semibold leading-tight ${isError ? 'text-destructive' : 'text-foreground'}`}>
                  {isAvailable && 'Nueva versión disponible'}
                  {isDownloading && 'Descargando actualización'}
                  {isReady && '¡Lista para instalar!'}
                  {isError && 'Error en la actualización'}
                </p>
                {isReady && (
                  <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-medium leading-4 text-muted-foreground">
                    Nueva
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                Venilu POS{' '}
                {updateInfo?.version && (
                  <span className="font-semibold text-foreground/70">
                    v{updateInfo.version}
                  </span>
                )}
              </p>
            </div>
          </div>

          {!isDownloading && (
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Cerrar aviso de actualización"
              className="-mr-1.5 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="mt-3">
          {(isAvailable || isReady || isError) && (
            <p className="text-xs text-muted-foreground leading-relaxed">
              {isAvailable && 'Descargando en segundo plano. Te avisaremos cuando esté lista.'}
              {isReady && 'La actualización ya está descargada. Reinicia la app para aplicarla.'}
              {isError && (error || 'Ocurrió un error al procesar la actualización.')}
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
              <div
                role="progressbar"
                aria-label="Progreso de descarga"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round((progress as any)?.percent ?? 0)}
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300 motion-reduce:transition-none"
                  style={{ width: `${(progress as any)?.percent ?? 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {(isReady || isError) && (
          <div className="mt-4 flex gap-2">
            {isReady ? (
              <>
                <button
                  type="button"
                  onClick={installNow}
                  className="flex-1 h-10 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                >
                  Reiniciar e instalar
                </button>
                <button
                  type="button"
                  onClick={() => setDismissed(true)}
                  className="h-10 rounded-full border border-border px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                >
                  Más tarde
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="flex-1 h-10 rounded-full border border-border px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                Cerrar
              </button>
            )}
          </div>
        )}

        {isAvailable && (
          <div className="mt-3 flex items-center gap-2">
            <Skeleton className="h-3.5 w-3.5 rounded-full" />
            <span className="text-xs text-muted-foreground">
              Descargando en segundo plano…
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
