import { useMemo, useState } from 'react';
import { ReceiptText, ShieldCheck, TriangleAlert } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@components/ui/table';
import { Skeleton } from '@components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@components/ui/dialog';
import { formatCurrency } from '@lib/currency';
import { formatDateTime } from '@lib/formatters';
import { cn } from '@lib/utils';
import { ncfCorto, ncfCompleto } from '@shared/ncf';
import { CODIGO_DGII, ESTADO_ECF, EstadoEcf, EcfDocument, VIA_ECF } from '../types';

type Filtro = 'todos' | 'pendientes' | 'enviados' | 'aceptados' | 'rechazados';

const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'pendientes', label: 'Pendientes' },
  { id: 'enviados', label: 'Enviados' },
  { id: 'aceptados', label: 'Aceptados' },
  { id: 'rechazados', label: 'Rechazados' },
];

const PENDIENTES: EstadoEcf[] = ['draft', 'signed', 'queued'];

function pasaFiltro(doc: EcfDocument, filtro: Filtro): boolean {
  switch (filtro) {
    case 'pendientes': return PENDIENTES.includes(doc.estado);
    case 'enviados':   return doc.estado === 'sent';
    case 'aceptados':  return doc.estado === 'accepted';
    case 'rechazados': return doc.estado === 'rejected';
    default:           return true;
  }
}

function Insignia({ estado }: { estado: EstadoEcf }) {
  const meta = ESTADO_ECF[estado];
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap',
      meta.tone,
    )}>
      {meta.label}
    </span>
  );
}

function Campo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5">
      <span className="text-muted-foreground shrink-0">{titulo}</span>
      <span className="text-right break-words min-w-0">{children}</span>
    </div>
  );
}

function Detalle({ doc, open, onOpenChange }: {
  doc: EcfDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!doc) return null;
  const meta = ESTADO_ECF[doc.estado];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4" aria-hidden="true" />
            <span className="font-mono">{doc.encf}</span>
          </DialogTitle>
          <DialogDescription>
            {ncfCompleto(String(doc.tipo))} · {VIA_ECF[doc.via]}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border divide-y divide-border text-sm">
          <Campo titulo="Estado">
            <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs font-medium', meta.tone)}>
              {meta.label}
            </span>
          </Campo>
          <Campo titulo="Tipo">{ncfCorto(String(doc.tipo))}</Campo>
          <Campo titulo="Monto total">
            <span className="tabular-nums font-medium">{formatCurrency(doc.monto_total)}</span>
          </Campo>
          <Campo titulo="ITBIS">
            <span className="tabular-nums">{formatCurrency(doc.itbis_total)}</span>
          </Campo>
          <Campo titulo="Fecha de emisión">
            <span className="tabular-nums">{doc.fecha_emision ?? '—'}</span>
          </Campo>
          {doc.nombre_comprador && <Campo titulo="Comprador">{doc.nombre_comprador}</Campo>}
          {doc.rnc_comprador && (
            <Campo titulo="RNC/Cédula">
              <span className="font-mono tabular-nums">{doc.rnc_comprador}</span>
            </Campo>
          )}
          {doc.codigo_seguridad && (
            <Campo titulo="Código de seguridad">
              <span className="font-mono tabular-nums">{doc.codigo_seguridad}</span>
            </Campo>
          )}
          {doc.track_id && (
            <Campo titulo="TrackId DGII">
              <span className="font-mono text-xs">{doc.track_id}</span>
            </Campo>
          )}
          {doc.dgii_code !== null && doc.dgii_code !== undefined && (
            <Campo titulo="Validación DGII">
              <span className="tabular-nums">
                {doc.dgii_code} — {CODIGO_DGII[doc.dgii_code] ?? 'Sin descripción'}
              </span>
            </Campo>
          )}
          <Campo titulo="Creado">{formatDateTime(doc.created_at)}</Campo>
          {doc.sent_at && <Campo titulo="Transmitido">{formatDateTime(doc.sent_at)}</Campo>}
        </div>

        {doc.dgii_mensajes && (
          <div className="rounded-lg border border-border bg-muted/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Respuesta de la DGII
            </p>
            <p className="text-sm whitespace-pre-wrap break-words">{doc.dgii_mensajes}</p>
          </div>
        )}

        {doc.last_error && (
          <div
            role="alert"
            className={cn(
              'flex items-start gap-2.5 rounded-lg border px-3.5 py-3',
              doc.estado === 'rejected'
                ? 'bg-red-500/10 border-red-500/20'
                : 'bg-amber-500/10 border-amber-500/20',
            )}
          >
            <TriangleAlert
              className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium">Error de emisión</p>
              <p className="text-sm break-words">{doc.last_error}</p>
            </div>
          </div>
        )}

        {doc.estado === 'accepted' && (
          <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Comprobante validado por la DGII.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function EcfTable({ documentos, loading }: {
  documentos: EcfDocument[];
  loading: boolean;
}) {
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [seleccion, setSeleccion] = useState<EcfDocument | null>(null);

  const filas = useMemo(
    () => documentos.filter((d) => pasaFiltro(d, filtro)),
    [documentos, filtro],
  );

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex flex-wrap items-center gap-1.5 px-4 py-3 border-b border-border">
        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltro(f.id)}
            aria-pressed={filtro === f.id}
            className={cn(
              'px-3 h-8 rounded-full border text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-[1px] focus-visible:ring-ring',
              filtro === f.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
            )}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {filas.length} de {documentos.length}
        </span>
      </div>

      {filas.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <ReceiptText className="h-9 w-9 mx-auto text-muted-foreground/50" strokeWidth={1.5} aria-hidden="true" />
          <p className="mt-3 text-sm font-medium">
            {documentos.length === 0
              ? 'Todavía no se han emitido comprobantes electrónicos'
              : 'Ningún comprobante coincide con el filtro'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
            {documentos.length === 0
              ? 'Los e-CF aparecerán aquí en cuanto se emita una venta con comprobante fiscal electrónico.'
              : 'Prueba con otro filtro para ver el resto de los comprobantes.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>e-NCF</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Comprador</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.map((doc) => (
                <TableRow
                  key={doc.id}
                  className="cursor-pointer"
                  onClick={() => setSeleccion(doc)}
                >
                  <TableCell className="font-mono text-xs">{doc.encf}</TableCell>
                  <TableCell className="whitespace-nowrap">{ncfCorto(String(doc.tipo))}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums text-sm">
                    {doc.fecha_emision ?? '—'}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate">
                    {doc.nombre_comprador ?? '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(doc.monto_total)}
                  </TableCell>
                  <TableCell>
                    <Insignia estado={doc.estado} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Detalle doc={seleccion} open={!!seleccion} onOpenChange={(o) => !o && setSeleccion(null)} />
    </div>
  );
}
