import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, FileKey2, PlugZap, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Skeleton } from "@components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/ui/select";
import { toast } from "sonner";
import { WidgetHeader } from "@renderer/shared/components/widget-header";
import { usePermissions } from "@renderer/features/auth/hooks/use-permission";
import { IPCResponse } from "@shared/types/ipc";
import { cn } from "@lib/utils";

// ─── Contrato IPC (espejo de main/modules/ecf) ───────────────────────────────

type Ambiente = "testecf" | "certecf" | "ecf";

const AMBIENTES: { value: Ambiente; label: string; nota: string }[] = [
  { value: "testecf", label: "Pre-certificación", nota: "Entorno de pruebas de la DGII." },
  { value: "certecf", label: "Certificación", nota: "Etapa de certificación del PSFE." },
  { value: "ecf", label: "Producción", nota: "Comprobantes con validez fiscal." },
];

interface EcfConfig {
  ambiente: Ambiente;
  cert_path: string | null;
  has_password: boolean;
}

interface EstadoCertificado {
  ruta: string;
  existe: boolean;
  vigente: boolean;
  nif: string | null;
  serial: string;
  emisor: string | null;
  valido_desde: string;
  valido_hasta: string;
  aviso_titular: string | null;
  error: string | null;
}

interface PruebaConexion {
  estatus: { ok: boolean; status: number; detalle: string };
  ambiente: Ambiente;
  autenticacion?: { ok: boolean; detalle: string };
}

function fechaCorta(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" });
}

function Campo({
  titulo,
  ok,
  detalle,
}: {
  titulo: string;
  ok: boolean | null;
  detalle: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span
        className={cn(
          "mt-1 h-2 w-2 rounded-full shrink-0",
          ok === null ? "bg-muted-foreground/40" : ok ? "bg-emerald-500" : "bg-red-500",
        )}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-sm font-medium">{titulo}</p>
        <p className="text-xs text-muted-foreground break-words">{detalle}</p>
      </div>
    </div>
  );
}

export function EcfSettings() {
  const perms = usePermissions("settings:view", "ecf:config");
  const canView = perms["settings:view"];
  const canEdit = perms["ecf:config"];
  const qc = useQueryClient();

  const { data: config, isLoading } = useQuery<IPCResponse<EcfConfig>>({
    queryKey: ["ecf-config"],
    enabled: canView,
    queryFn: async () =>
      (await window.ipcRenderer.invoke("ecf:config:get")) as IPCResponse<EcfConfig>,
  });

  const [certPath, setCertPath] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [probando, setProbando] = useState(false);
  const [resultado, setResultado] = useState<PruebaConexion | null>(null);
  const [guardando, setGuardando] = useState(false);

  const ruta = certPath ?? config?.data?.cert_path ?? "";
  const ambiente = config?.data?.ambiente ?? "testecf";

  const { data: certInfo } = useQuery<IPCResponse<EstadoCertificado>>({
    queryKey: ["ecf-cert", ruta, config?.data?.has_password],
    enabled: canView && Boolean(ruta),
    queryFn: async () =>
      (await window.ipcRenderer.invoke("ecf:certificate-info")) as IPCResponse<EstadoCertificado>,
  });

  const guardar = async (payload: Record<string, unknown>) => {
    setGuardando(true);
    try {
      const res = (await window.ipcRenderer.invoke("ecf:config:save", payload)) as IPCResponse<EcfConfig>;
      if (res.success) {
        toast.success("Ajustes e-CF guardados");
        qc.invalidateQueries({ queryKey: ["ecf-config"] });
        qc.invalidateQueries({ queryKey: ["ecf-cert"] });
        return true;
      }
      toast.error("No se pudo guardar", { description: res.message });
      return false;
    } catch (err) {
      toast.error("No se pudo guardar", {
        description: err instanceof Error ? err.message : "Error desconocido",
      });
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const examinar = async () => {
    try {
      const res = (await window.ipcRenderer.invoke("ecf:pick-certificate")) as IPCResponse<string>;
      if (res.success && res.data) {
        setCertPath(res.data);
        setPassword("");
      } else if (res.message && res.message !== "Selección cancelada") {
        toast.error("No se pudo abrir el selector", { description: res.message });
      }
    } catch (err) {
      toast.error("No se pudo abrir el selector", {
        description: err instanceof Error ? err.message : "Error desconocido",
      });
    }
  };

  const probarConexion = async () => {
    setProbando(true);
    setResultado(null);
    try {
      const res = (await window.ipcRenderer.invoke("ecf:connection-test")) as IPCResponse<PruebaConexion>;
      if (res.success && res.data) {
        setResultado(res.data);
        const dgiiOk = res.data.estatus.ok;
        const authOk = res.data.autenticacion?.ok ?? null;
        if (dgiiOk && authOk !== false) {
          toast.success("Conexión con la DGII verificada");
        } else {
          toast.warning("La prueba encontró problemas", {
            description: res.data.autenticacion?.detalle ?? `HTTP ${res.data.estatus.status}`,
          });
        }
      } else {
        toast.error("No se pudo probar la conexión", { description: res.message });
      }
    } catch (err) {
      toast.error("No se pudo probar la conexión", {
        description: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setProbando(false);
    }
  };

  if (!canView) return null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  const cert = certInfo?.data;

  return (
    <div className="space-y-6">
      {/* ── Ambiente DGII ─────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg p-6">
        <WidgetHeader
          icon={PlugZap}
          title="Ambiente de la DGII"
          subtitle="Dónde se transmiten los comprobantes electrónicos"
        />
        <div className="mt-5 space-y-3">
          <Select
            value={ambiente}
            disabled={!canEdit || guardando}
            onValueChange={(v) => void guardar({ ambiente: v })}
          >
            <SelectTrigger className="bg-background w-full sm:max-w-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AMBIENTES.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {AMBIENTES.find((a) => a.value === ambiente)?.nota}
            {ambiente === "ecf" && (
              <span className="block mt-1 text-amber-600 dark:text-amber-400">
                En Producción los comprobantes emitidos tienen validez fiscal.
              </span>
            )}
          </p>
        </div>
      </div>

      {/* ── Certificado digital ───────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg p-6">
        <WidgetHeader
          icon={FileKey2}
          title="Certificado digital del PSFE"
          subtitle="Archivo .p12/.pfx con el que se firman los e-CF"
        />

        <div className="mt-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ecf-cert-path">Archivo de certificado</Label>
            <div className="flex gap-2">
              <Input
                id="ecf-cert-path"
                value={ruta}
                readOnly
                placeholder="Sin certificado configurado"
                className="bg-background font-mono text-xs"
              />
              <Button variant="outline" onClick={() => void examinar()} disabled={!canEdit || guardando}>
                Examinar…
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ecf-cert-password">Contraseña del certificado</Label>
            <div className="flex gap-2">
              <Input
                id="ecf-cert-password"
                type="password"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={config?.data?.has_password ? "•••••••• (guardada)" : "Contraseña del .p12"}
                disabled={!canEdit || guardando}
                className="bg-background"
              />
              <Button
                variant="outline"
                disabled={!canEdit || guardando || (!password && certPath === null)}
                onClick={() => void guardar({ cert_path: certPath ?? ruta, cert_password: password })}
              >
                Guardar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Se guarda cifrada con la llave de este equipo y solo la usa el proceso de firma.
            </p>
          </div>

          {ruta && cert && (
            <div className="rounded-lg border border-border divide-y divide-border text-sm">
              <div className="flex items-start justify-between gap-4 px-4 py-3">
                <span className="text-muted-foreground shrink-0">Estado</span>
                {cert.error ? (
                  <span className="text-right text-red-600 dark:text-red-400 break-words">
                    {cert.error}
                  </span>
                ) : cert.vigente ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                    <BadgeCheck className="h-4 w-4" aria-hidden="true" /> Vigente
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400 font-medium">
                    <TriangleAlert className="h-4 w-4" aria-hidden="true" /> Vencido
                  </span>
                )}
              </div>
              {cert.serial && (
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="text-muted-foreground shrink-0">Serie</span>
                  <span className="font-mono text-xs break-all text-right">{cert.serial}</span>
                </div>
              )}
              {cert.nif && (
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="text-muted-foreground shrink-0">NIF declarado (SN)</span>
                  <span className="font-mono tabular-nums">{cert.nif}</span>
                </div>
              )}
              {cert.valido_hasta && (
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="text-muted-foreground shrink-0">Vigencia</span>
                  <span className="tabular-nums">
                    {fechaCorta(cert.valido_desde)} → {fechaCorta(cert.valido_hasta)}
                  </span>
                </div>
              )}
            </div>
          )}

          {cert?.aviso_titular && (
            <div role="status" className="flex items-start gap-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3">
              <TriangleAlert
                className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                aria-hidden="true"
              />
              <p className="text-sm text-amber-700 dark:text-amber-300">{cert.aviso_titular}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Prueba de conexión ────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg p-6">
        <WidgetHeader
          icon={PlugZap}
          title="Conexión con la DGII"
          subtitle="Verifica los servicios y, si hay certificado, la autenticación"
        />
        <div className="mt-5 flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => void probarConexion()}
            disabled={!canEdit || probando}
          >
            {probando ? (
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <PlugZap className="h-4 w-4" aria-hidden="true" />
            )}
            Probar conexión
          </Button>
          {resultado && (
            <span className="text-xs text-muted-foreground">
              Ambiente <span className="font-mono">{resultado.ambiente}</span>
            </span>
          )}
        </div>

        {resultado && (
          <div className="mt-4 space-y-3 rounded-lg border border-border p-4">
            <Campo
              titulo="Servicios de la DGII"
              ok={resultado.estatus.ok}
              detalle={
                resultado.estatus.ok
                  ? `Respuesta HTTP ${resultado.estatus.status}.`
                  : resultado.estatus.detalle
              }
            />
            {resultado.autenticacion && (
              <Campo
                titulo="Autenticación (semilla → token)"
                ok={resultado.autenticacion.ok}
                detalle={resultado.autenticacion.detalle}
              />
            )}
            {!config?.data?.cert_path && (
              <Campo
                titulo="Certificado"
                ok={null}
                detalle="Sin certificado configurado: la autenticación no se pudo probar."
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
