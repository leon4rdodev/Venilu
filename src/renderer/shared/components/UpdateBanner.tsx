import { Download, RefreshCw, X } from 'lucide-react';
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
      className="fixed bottom-4 right-4 z-50 flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-lg shadow-black/10 backdrop-blur-sm"
      style={{ minWidth: 300, maxWidth: 380 }}
    >
      {/* Icon */}
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isReady ? 'bg-emerald-500/15 text-emerald-500' : 'bg-primary/10 text-primary'}`}>
        {isDownloading ? (
          <Download className="h-4 w-4 animate-bounce" />
        ) : (
          <RefreshCw className={`h-4 w-4 ${isReady ? '' : 'animate-spin'}`} style={isReady ? {} : { animationDuration: '3s' }} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 text-sm">
        {isAvailable && (
          <>
            <p className="font-semibold text-foreground">Nueva versión disponible</p>
            <p className="text-muted-foreground">
              v{updateInfo?.version} — Descargando en segundo plano…
            </p>
          </>
        )}

        {isDownloading && (
          <>
            <p className="font-semibold text-foreground">Descargando actualización…</p>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress?.percent ?? 0}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{progress?.percent ?? 0}%</p>
          </>
        )}

        {isReady && (
          <>
            <p className="font-semibold text-foreground">
              v{updateInfo?.version} lista para instalar
            </p>
            <p className="text-muted-foreground">Instala ahora o al cerrar la app.</p>
            <button
              onClick={installNow}
              className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Reiniciar e instalar
            </button>
          </>
        )}
      </div>

      {/* Dismiss */}
      {!isDownloading && (
        <button
          onClick={() => setDismissed(true)}
          className="mt-0.5 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
