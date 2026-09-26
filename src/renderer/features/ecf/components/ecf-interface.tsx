import { RefreshCw } from 'lucide-react';
import { Button } from '@components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { useEcfDocuments, useEcfStats } from '../hooks/use-ecf';
import { EcfStatsBar } from './ecf-stats';
import { EcfTable } from './ecf-table';

export function EcfInterface() {
  const qc = useQueryClient();

  const documentos = useEcfDocuments(200);
  const stats = useEcfStats();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Comprobantes fiscales electrónicos (e-CF) transmitidos a la DGII: su e-NCF,
          el estado de la validación y cualquier rechazo con el detalle del error.
        </p>
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

      <EcfStatsBar stats={stats.data?.data} loading={stats.isLoading} />

      <EcfTable
        documentos={documentos.data?.data ?? []}
        loading={documentos.isLoading}
      />
    </div>
  );
}
