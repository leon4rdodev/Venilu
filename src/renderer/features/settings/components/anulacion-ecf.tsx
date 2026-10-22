import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/ui/dialog";
import { WidgetHeader } from "@renderer/shared/components/widget-header";
import { usePermissions } from "@renderer/features/auth/hooks/use-permission";
import { IPCResponse } from "@shared/types/ipc";
import { formatDateTime } from "@lib/formatters";
import { cn } from "@lib/utils";

/**
 * Anulación de e-NCF no utilizados ante la DGII (formato ANECF).
 * Espejo de `main/modules/ecf/services/anulacion.ts`.
 */

export interface AnulacionView {
  id: string;
  tipo: 31 | 32 | 34;
  desde: string;
  hasta: string;
  cantidad: number;
  estado: "pendiente" | "aceptada" | "parcial" | "rechazada";
  ambiente: string;
  dgii_mensajes: string | null;
  last_error: string | null;
  username: string | null;
  created_at: string;
}

/** Datos mínimos de la secuencia para proponer el rango. */
export interface SecuenciaAnulable {
  type: "31" | "32" | "34";
  next_number: number;
  to_number: number;
}

const ESTADOS: Record<AnulacionView["estado"], { label: string; tone: string }> = {
  pendiente: { label: "Pendiente de envío", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  aceptada: { label: "Anulada", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  parcial: { label: "Anulada en parte", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  rechazada: { label: "Rechazada", tone: "bg-destructive/10 text-red-700 dark:text-red-300" },
};

const encf = (tipo: string, n: number) => `E${tipo}${String(n).padStart(10, "0")}`;

function refrescar(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ["ecf-anulaciones"] });
  void qc.invalidateQueries({ queryKey: ["ncf-sequences"] });
}

export function AnularRangoDialog({
  secuencia,
  onOpenChange,
}: {
  secuencia: SecuenciaAnulable | null;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (secuencia) {
      setDesde(String(secuencia.next_number));
      setHasta(String(secuencia.to_number));
    }
  }, [secuencia]);

  if (!secuencia) return null;

  const d = Number(desde);
  const h = Number(hasta);
  const valido =
    Number.isInteger(d) && Number.isInteger(h) && d >= secuencia.next_number && h >= d && h <= secuencia.to_number;
  const cantidad = valido ? h - d + 1 : 0;

  const anular = async () => {
    setEnviando(true);
    try {
      const res = (await window.ipcRenderer.invoke("ecf:anular", {
        tipo: secuencia.type,
        desde: d,
        hasta: h,
      })) as IPCResponse<AnulacionView>;
      if (!res.success || !res.data) {
        toast.error("No se pudo anular", { description: res.message });
        return;
      }
      const a = res.data;
      if (a.estado === "aceptada") toast.success(`${a.cantidad} e-NCF anulados ante la DGII`);
      else if (a.estado === "parcial")
        toast.warning("La DGII anuló el rango en parte", { description: a.dgii_mensajes ?? undefined });
      else if (a.estado === "rechazada")
        toast.error("La DGII rechazó la anulación", { description: a.dgii_mensajes ?? undefined });
      else
        toast.warning("Anulación registrada, pendiente de envío", {
          description: `${a.last_error ?? "Sin respuesta de la DGII"}. Los números ya no se usarán; reenvíala desde «Anulaciones de e-NCF».`,
          duration: 10_000,
        });
      onOpenChange(false);
    } catch (err) {
      toast.error("No se pudo anular", { description: err instanceof Error ? err.message : "Error desconocido" });
    } finally {
      setEnviando(false);
      refrescar(qc);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Anular e-NCF no usados · tipo {secuencia.type}</DialogTitle>
          <DialogDescription>
            Informa a la DGII los números de esta secuencia que no se van a usar (por ejemplo, al vencer
            o al cambiar de rango). Solo se pueden anular números que nunca se asignaron; para un
            comprobante ya entregado se emite una Nota de Crédito.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="anular-desde">Desde</Label>
            <Input
              id="anular-desde"
              type="number"
              inputMode="numeric"
              min={secuencia.next_number}
              max={secuencia.to_number}
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="bg-background tabular-nums"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="anular-hasta">Hasta</Label>
            <Input
              id="anular-hasta"
              type="number"
              inputMode="numeric"
              min={secuencia.next_number}
              max={secuencia.to_number}
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="bg-background tabular-nums"
            />
          </div>
        </div>
        <p className={cn("text-sm", valido ? "text-muted-foreground" : "text-red-600 dark:text-red-400")}>
          {valido ? (
            <>
              Se anularán <b className="text-foreground">{cantidad.toLocaleString("es-DO")}</b> e-NCF:{" "}
              <span className="font-mono">{encf(secuencia.type, d)}</span> a{" "}
              <span className="font-mono">{encf(secuencia.type, h)}</span>. No se puede deshacer.
            </>
          ) : (
            `El rango debe estar entre ${secuencia.next_number.toLocaleString("es-DO")} (próximo sin usar) y ${secuencia.to_number.toLocaleString("es-DO")}.`
          )}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={() => void anular()} disabled={!valido || enviando}>
            <Ban className="h-4 w-4" aria-hidden="true" />
            {enviando ? "Enviando a la DGII…" : "Anular ante la DGII"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AnulacionesCard() {
  const qc = useQueryClient();
  const perms = usePermissions("ecf:config");
  const [reenviando, setReenviando] = useState<string | null>(null);

  const { data } = useQuery<IPCResponse<AnulacionView[]>>({
    queryKey: ["ecf-anulaciones"],
    queryFn: async () =>
      (await window.ipcRenderer.invoke("ecf:anulaciones:list")) as IPCResponse<AnulacionView[]>,
  });
  const filas = data?.data ?? [];
  if (filas.length === 0) return null;

  const reenviar = async (id: string) => {
    setReenviando(id);
    try {
      const res = (await window.ipcRenderer.invoke("ecf:anulacion:reenviar", { id })) as IPCResponse<AnulacionView>;
      if (res.success && res.data) {
        const e = ESTADOS[res.data.estado];
        if (res.data.estado === "pendiente") toast.warning("Sigue pendiente", { description: res.data.last_error ?? undefined });
        else toast.info(`Anulación: ${e.label}`, { description: res.data.dgii_mensajes ?? undefined });
      } else {
        toast.error("No se pudo reenviar", { description: res.message });
      }
    } finally {
      setReenviando(null);
      refrescar(qc);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <WidgetHeader
        icon={Ban}
        title="Anulaciones de e-NCF"
        subtitle="Números no usados informados a la DGII (formato ANECF)"
      />
      <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
        {filas.map((a) => (
          <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0 space-y-0.5">
              <p className="font-mono text-sm tabular-nums">
                {a.desde} → {a.hasta}{" "}
                <span className="font-sans text-muted-foreground">({a.cantidad.toLocaleString("es-DO")})</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(a.created_at)} · {a.ambiente}
                {a.username ? ` · ${a.username}` : ""}
              </p>
              {(a.dgii_mensajes || a.last_error) && (
                <p className="text-xs text-muted-foreground break-words whitespace-pre-wrap">
                  {a.dgii_mensajes ?? a.last_error}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={cn("rounded-full px-2 py-1 text-xs font-medium whitespace-nowrap", ESTADOS[a.estado].tone)}>
                {ESTADOS[a.estado].label}
              </span>
              {a.estado === "pendiente" && perms["ecf:config"] && (
                <Button size="sm" variant="outline" onClick={() => void reenviar(a.id)} disabled={reenviando === a.id}>
                  <RefreshCw className={cn("h-4 w-4", reenviando === a.id && "animate-spin")} aria-hidden="true" />
                  Reenviar
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
