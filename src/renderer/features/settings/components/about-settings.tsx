import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Info, KeyRound, MonitorCog, Store } from "lucide-react";
import { Button } from "@components/ui/button";
import { WidgetHeader } from "@renderer/shared/components/widget-header";
import { Skeleton } from "@components/ui/skeleton";
import { cn } from "@lib/utils";
import { LicenseKeyForm, useLicense, type LicenseStatus } from "@renderer/features/license";
import { useSettings } from "../hooks/use-settings";

interface AppInfo {
  version: string;
  electron: string;
  chrome: string;
  node: string;
  platform: string;
  arch: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  win32: "Windows",
  darwin: "macOS",
  linux: "Linux",
};

/** "2026-12-31" → "31 dic 2026" (sin desfase de zona horaria). */
function formatLicenseDate(value: string | undefined): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" });
}

interface LicenseSummary {
  /** Estado corto para la píldora (glanceable). */
  pill: string;
  pillClassName: string;
  dotClassName: string;
  /** Frase principal bajo el encabezado. */
  headline: string;
  /** Detalle secundario (vencimiento, días restantes). */
  detail?: string;
}

/** Jerarquía: estado (píldora) → titular → detalle. Color + texto siempre juntos. */
function summarizeLicense(status: LicenseStatus): LicenseSummary {
  const { state, license, trialDaysLeft, daysToExpiry } = status;
  if (state === "trial") {
    const days = trialDaysLeft ?? 0;
    return {
      pill: "Prueba",
      pillClassName: "bg-muted text-foreground",
      dotClassName: "bg-muted-foreground",
      headline: "Período de prueba",
      detail: `${days} ${days === 1 ? "día restante" : "días restantes"}. Activa una licencia para seguir usando Venilu.`,
    };
  }
  if (state === "active") {
    if (license?.type === "anual") {
      const expiringSoon = typeof daysToExpiry === "number" && daysToExpiry <= 30;
      return {
        pill: expiringSoon ? "Vence pronto" : "Activa",
        pillClassName: expiringSoon
          ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
          : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        dotClassName: expiringSoon ? "bg-amber-500" : "bg-emerald-500",
        headline: "Licencia anual",
        detail: expiringSoon && typeof daysToExpiry === "number"
          ? `Vence el ${formatLicenseDate(license.expires)} (${daysToExpiry} ${daysToExpiry === 1 ? "día" : "días"}). Renueva para no interrumpir las ventas.`
          : `Vence el ${formatLicenseDate(license.expires)}.`,
      };
    }
    return {
      pill: "Activa",
      pillClassName: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      dotClassName: "bg-emerald-500",
      headline: "Licencia perpetua",
      detail: "Sin fecha de vencimiento.",
    };
  }
  if (state === "trial_expired") {
    return {
      pill: "Prueba vencida",
      pillClassName: "bg-destructive/10 text-destructive",
      dotClassName: "bg-destructive",
      headline: "El período de prueba terminó",
      detail: "Activa una licencia para seguir usando Venilu.",
    };
  }
  return {
    pill: "Vencida",
    pillClassName: "bg-destructive/10 text-destructive",
    dotClassName: "bg-destructive",
    headline: "Licencia vencida",
    detail: license?.expires
      ? `Venció el ${formatLicenseDate(license.expires)}. Renueva para seguir usando Venilu.`
      : "Renueva para seguir usando Venilu.",
  };
}

function LicenseCard() {
  const { status, isLoading } = useLicense();
  const [showForm, setShowForm] = useState(false);

  const summary = status ? summarizeLicense(status) : null;
  const license = status?.license;

  const licenseRows: { label: string; value: string; mono?: boolean }[] = license
    ? [
        { label: "Cliente", value: license.customer },
        ...(license.business ? [{ label: "Negocio", value: license.business }] : []),
        { label: "Tipo", value: license.type === "perpetua" ? "Perpetua" : "Anual" },
        { label: "Emitida", value: formatLicenseDate(license.issued) },
        ...(license.expires ? [{ label: "Vence", value: formatLicenseDate(license.expires) }] : []),
        { label: "ID de licencia", value: license.id, mono: true },
      ]
    : [];

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <WidgetHeader
        icon={KeyRound}
        title="Licencia"
        subtitle="Estado de tu licencia de Venilu"
        action={
          isLoading ? (
            <Skeleton className="h-6 w-20 rounded-full" />
          ) : summary ? (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
                summary.pillClassName
              )}
            >
              <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", summary.dotClassName)} />
              {summary.pill}
            </span>
          ) : null
        }
      />

      {/* Titular + detalle: lo primero que se lee */}
      {isLoading ? (
        <div className="mt-5 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
      ) : summary ? (
        <div className="mt-5">
          <p className="text-base font-semibold tracking-tight">{summary.headline}</p>
          {summary.detail && (
            <p className="text-sm text-muted-foreground mt-0.5">{summary.detail}</p>
          )}
        </div>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">
          No se pudo consultar el estado de la licencia.
        </p>
      )}

      {licenseRows.length > 0 && (
        <dl className="mt-4 rounded-lg border border-border overflow-hidden divide-y divide-border">
          {licenseRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-2.5">
              <dt className="text-sm text-muted-foreground shrink-0">{row.label}</dt>
              <dd
                className={cn("text-sm text-right truncate", row.mono ? "font-mono tabular-nums" : "tabular-nums")}
                title={row.value}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowForm((v) => !v)}
          aria-expanded={showForm}
          aria-controls="license-key-form"
          className="-ml-2.5 text-muted-foreground hover:text-foreground"
        >
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", showForm && "rotate-180")}
            strokeWidth={1.75}
            aria-hidden="true"
          />
          {license ? "Cambiar licencia" : "Activar licencia"}
        </Button>
        {showForm && (
          <div id="license-key-form" className="mt-3 max-w-md">
            <LicenseKeyForm onActivated={() => setShowForm(false)} />
          </div>
        )}
      </div>
    </div>
  );
}

export function AboutSettings() {
  const { settings } = useSettings();

  const appInfoQuery = useQuery({
    queryKey: ["app-info"],
    queryFn: async () => {
      const result = (await window.ipcRenderer.invoke("app:info")) as {
        success: boolean;
        data?: AppInfo;
        message?: string;
      };
      if (!result.success || !result.data) {
        throw new Error(result.message || "Error al obtener información de la aplicación");
      }
      return result.data;
    },
    staleTime: Infinity,
  });

  const logoQuery = useQuery({
    queryKey: ["business-logo", settings?.logo_filename ?? null],
    enabled: !!settings?.logo_filename,
    queryFn: async () => {
      const result = (await window.ipcRenderer.invoke("get-logo", {
        fileName: settings!.logo_filename,
      })) as { success: boolean; fileData?: string };
      return result.success && result.fileData ? result.fileData : null;
    },
    staleTime: Infinity,
  });

  const info = appInfoQuery.data;
  const platformLabel = info
    ? `${PLATFORM_LABELS[info.platform] ?? info.platform} (${info.arch})`
    : "";

  const systemRows: { label: string; value: string }[] = info
    ? [
        { label: "Versión de Venilu", value: info.version },
        { label: "Electron", value: info.electron },
        { label: "Chromium", value: info.chrome },
        { label: "Node", value: info.node },
        { label: "Plataforma", value: platformLabel },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Business identity */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-4">
          {logoQuery.data ? (
            <img
              src={logoQuery.data}
              alt="Logo del negocio"
              className="h-14 w-14 rounded-lg border border-border object-contain bg-white p-1 shrink-0"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted shrink-0" aria-hidden="true">
              <Store className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight truncate">
              {settings?.business_name || "Mi Negocio"}
            </h3>
            <p className="text-sm text-muted-foreground truncate">
              {settings?.business_address || "Sistema de punto de venta"}
            </p>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between gap-4 border-t border-border pt-4">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium">Venilu POS</span>
            {appInfoQuery.isPending ? (
              <Skeleton className="h-6 w-16 rounded-full" />
            ) : (
              <span
                className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs font-medium font-mono tabular-nums"
                aria-label={info ? `Versión ${info.version}` : "Versión no disponible"}
              >
                {info ? `v${info.version}` : "—"}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground shrink-0">
            © {new Date().getFullYear()} Venilu
          </p>
        </div>
      </div>

      {/* License */}
      <LicenseCard />

      {/* Runtime information */}
      <div className="bg-card border border-border rounded-lg p-6">
        <WidgetHeader
          icon={MonitorCog}
          title="Sistema"
          subtitle="Información técnica de la aplicación"
        />
        <div className="mt-4 rounded-lg border border-border overflow-hidden">
          {appInfoQuery.isPending ? (
            <div className="divide-y divide-border" aria-busy="true" aria-label="Cargando información del sistema">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ))}
            </div>
          ) : appInfoQuery.isError ? (
            <div role="alert" className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
              <Info className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              No se pudo obtener la información del sistema
            </div>
          ) : (
            <dl className="divide-y divide-border">
              {systemRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-2.5">
                  <dt className="text-sm text-muted-foreground">{row.label}</dt>
                  <dd className="text-sm font-mono tabular-nums text-right">{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}
