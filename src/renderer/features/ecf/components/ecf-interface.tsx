import { RefreshCw, Send } from 'lucide-react';
import { Button } from '@components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '@renderer/features/auth/hooks/use-permission';
import {
  useEcfDocuments,
  useEcfEmit,
  useEcfEmitPending,
  useEcfRefresh,
  useEcfStats,
} from '../hooks/use-ecf';
import { EcfStatsBar } from './ecf-stats';
import { EcfTable } from './ecf-table';

export function EcfInterface() {
  const qc = useQueryClient();

  const documentos = useEcfDocuments(200);
  const stats = useEcfStats();

  const perms = usePermissions('ecf:view', 'ecf:emit');
  const puedeEmitir = perms['ecf:emit'];

  const emitir = useEcfEmit();
  const emitirPendientes = useEcfEmitPending();
  const consultar = useEcfRefresh();

  const s = stats.data?.data;
  const pendientes = (s?.draft ?? 0) + (s?.signed ?? 0) + (s?.queued ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Comprobantes fiscales electrónicos (e-CF) transmitidos a la DGII: su e-NCF,
          el estado de la validación y cualquier rechazo con el detalle del error.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {puedeEmitir && (
            <Button
              size="sm"
              onClick={() => emitirPendientes.mutate()}
              disabled={emitirPendientes.isPending}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {emitirPendientes.isPending
                ? 'Emitiendo…'
                : `Emitir pendientes${pendientes > 0 ? ` (${pendientes})` : ''}`}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void qc.invalidateQueries({ queryKey: ['ecf-documents'] });
              void qc.invalidateQueries({ queryKey: ['ecf-stats'] });
            }}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Actualizar
          </Button>
        </div>
      </div>

      <EcfStatsBar stats={stats.data?.data} loading={stats.isLoading} />

      <EcfTable
        documentos={documentos.data?.data ?? []}
        loading={documentos.isLoading}
        acciones={{
          onEmitir: puedeEmitir ? (id) => emitir.mutate(id) : undefined,
          onConsultar: (id) => consultar.mutate(id),
          emitando: emitir.isPending,
          consultando: consultar.isPending,
        }}
      />
    </div>
  );
}
