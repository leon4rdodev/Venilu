import { useState } from 'react';
import { CircleAlert, Clock, FilePlus2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@components/ui/dialog';
import { formatDateTime } from '@lib/formatters';
import { cn } from '@lib/utils';
import {
  useContingencia,
  useFinalizarContingencia,
  useGenerarReemplazos,
  useIniciarContingencia,
} from '../hooks/use-ecf';
import type { EcfStats } from '../types';

/** Límite de la contingencia por imposibilidad técnica (Informe Técnico §19.2.1). */
const LIMITE_DIAS = 15;

function MotivoDialog({
  open,
  onOpenChange,
  titulo,
  descripcion,
  etiqueta,
  placeholder,
  confirmar,
  pendiente,
  destructivo,
  onConfirmar,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  titulo: string;
  descripcion: React.ReactNode;
  etiqueta: string;
  placeholder: string;
  confirmar: string;
  pendiente: boolean;
  destructivo?: boolean;
  onConfirmar: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const valido = motivo.trim().length >= 5;
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setMotivo('');
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">{descripcion}</div>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="motivo-contingencia">{etiqueta}</Label>
          <Textarea
            id="motivo-contingencia"
            value={motivo}
            maxLength={500}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={placeholder}
            className="bg-background min-h-24"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pendiente}>
            Cancelar
          </Button>
          <Button
            variant={destructivo ? 'destructive' : 'default'}
            disabled={!valido || pendiente}
            onClick={() => onConfirmar(motivo.trim())}
          >
            {pendiente ? 'Procesando…' : confirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Aviso({
  tono,
  icon: Icon,
  titulo,
  children,
}: {
  tono: 'rojo' | 'ambar';
  icon: React.ElementType;
  titulo: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-lg border px-4 py-3',
        tono === 'rojo' ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20',
      )}
    >
      <Icon
        className={cn(
          'h-4 w-4 mt-0.5 shrink-0',
          tono === 'rojo' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400',
        )}
        aria-hidden="true"
      />
      <div className="min-w-0 text-sm">
        <p className="font-medium">{titulo}</p>
        {children && <div className="text-muted-foreground mt-0.5">{children}</div>}
      </div>
    </div>
  );
}

/**
 * Avisos de plazo (72 h sin transmitir) y panel de la contingencia por
 * imposibilidad técnica.
 */
export function EcfContingenciaPanel({
  stats,
  puedeConfigurar,
  puedeEmitir,
}: {
  stats?: EcfStats;
  puedeConfigurar: boolean;
  puedeEmitir: boolean;
}) {
  const { data } = useContingencia();
  const estado = data?.data;
  const iniciar = useIniciarContingencia();
  const finalizar = useFinalizarContingencia();
  const reemplazos = useGenerarReemplazos();
  const [dialogo, setDialogo] = useState<'iniciar' | 'finalizar' | null>(null);

  const activa = estado?.activa ?? null;
  const disponiblesB = estado ? estado.disponibles_b.B01 + estado.disponibles_b.B02 : 0;

  return (
    <div className="space-y-3">
      {(stats?.fuera_de_plazo ?? 0) > 0 && (
        <Aviso tono="rojo" icon={Clock} titulo={`${stats!.fuera_de_plazo} e-CF sin transmitir hace más de 72 horas`}>
          La DGII da 72 horas para enviar los e-CF emitidos sin conexión. Revisa el error de cada uno
          (certificado, conexión o datos fiscales) y usa «Emitir pendientes».
        </Aviso>
      )}
      {(stats?.por_vencer ?? 0) > 0 && (
        <Aviso tono="ambar" icon={Clock} titulo={`${stats!.por_vencer} e-CF llevan más de 48 horas sin transmitir`}>
          Quedan menos de 24 horas para el plazo de 72 horas de la DGII.
        </Aviso>
      )}

      {activa ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <ShieldAlert className="h-5 w-5 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-semibold">Contingencia activa: se emiten comprobantes serie B</p>
                <p className="text-sm text-muted-foreground">
                  Desde {formatDateTime(activa.desde)} · día {(estado?.dias ?? 0) + 1} de {LIMITE_DIAS} ·{' '}
                  {activa.motivo}
                </p>
              </div>
            </div>
            {puedeConfigurar && (
              <Button size="sm" onClick={() => setDialogo('finalizar')}>
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                Finalizar contingencia
              </Button>
            )}
          </div>
          {estado?.excede_limite && (
            <Aviso tono="rojo" icon={CircleAlert} titulo="Se superó el límite de 15 días calendario">
              La DGII no admite una contingencia por imposibilidad técnica de más de 15 días. Restablece la
              emisión de e-CF y registra la salida en la Oficina Virtual.
            </Aviso>
          )}
          <p className="text-xs text-muted-foreground">
            Recuerda registrar la entrada y la salida en la Oficina Virtual de la DGII (Facturación
            Electrónica → Contingencia FE). Quedan {disponiblesB.toLocaleString('es-DO')} NCF B01/B02 y{' '}
            {(estado?.disponibles_b.B04 ?? 0).toLocaleString('es-DO')} B04.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground min-w-0">
            <span className="font-medium text-foreground">Contingencia por falla técnica:</span> si el
            sistema no puede generar e-CF, actívala para seguir facturando con NCF serie B
            {estado ? ` (${disponiblesB.toLocaleString('es-DO')} disponibles)` : ''}.
          </p>
          {puedeConfigurar && (
            <Button size="sm" variant="outline" onClick={() => setDialogo('iniciar')}>
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              Declarar contingencia
            </Button>
          )}
        </div>
      )}

      {(estado?.pendientes_reemplazo ?? 0) > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <p className="text-sm min-w-0">
            <span className="font-medium">{estado!.pendientes_reemplazo} comprobante(s) serie B</span>{' '}
            <span className="text-muted-foreground">
              de una contingencia ya cerrada aún no tienen su e-CF de reemplazo (falta secuencia e-NCF o
              hubo un error).
            </span>
          </p>
          {puedeEmitir && (
            <Button size="sm" variant="outline" onClick={() => reemplazos.mutate()} disabled={reemplazos.isPending}>
              <FilePlus2 className="h-4 w-4" aria-hidden="true" />
              {reemplazos.isPending ? 'Generando…' : 'Generar reemplazos'}
            </Button>
          )}
        </div>
      )}

      <MotivoDialog
        open={dialogo === 'iniciar'}
        onOpenChange={(v) => setDialogo(v ? 'iniciar' : null)}
        titulo="Declarar contingencia"
        descripcion={
          <>
            <p>
              Úsala solo si una <b>falla técnica impide generar e-CF</b>. Si lo que falta es internet, no
              hace falta: los e-CF se siguen emitiendo y se envían solos al volver la conexión.
            </p>
            <p>
              Mientras dure, las ventas con comprobante usarán NCF serie B. Al finalizarla, Venilu crea un
              e-CF de reemplazo por cada uno. Máximo {LIMITE_DIAS} días.
            </p>
          </>
        }
        etiqueta="Motivo de la falla"
        placeholder="Ej.: el certificado digital no carga en este equipo"
        confirmar="Activar contingencia"
        pendiente={iniciar.isPending}
        destructivo
        onConfirmar={(m) => iniciar.mutate(m, { onSuccess: () => setDialogo(null) })}
      />
      <MotivoDialog
        open={dialogo === 'finalizar'}
        onOpenChange={(v) => setDialogo(v ? 'finalizar' : null)}
        titulo="Finalizar contingencia"
        descripcion={
          <p>
            Se vuelve a emitir e-CF y se crean los e-CF de reemplazo de los NCF serie B emitidos durante la
            contingencia. Esos reemplazos van solo a la DGII: no se entregan al cliente.
          </p>
        }
        etiqueta="¿Cómo se resolvió?"
        placeholder="Ej.: se reinstaló el certificado digital"
        confirmar="Finalizar y generar reemplazos"
        pendiente={finalizar.isPending}
        onConfirmar={(m) => finalizar.mutate(m, { onSuccess: () => setDialogo(null) })}
      />
    </div>
  );
}
