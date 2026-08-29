import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Info, KeyRound, MonitorCog, Store } from "lucide-react";
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

function licensePill(status: LicenseStatus): { label: string; className: string } {
  const { state, license, trialDaysLeft, daysToExpiry } = status;
  if (state === "trial") {
    const days = trialDaysLeft ?? 0;
    return {
      label: `Prueba — ${days} ${days === 1 ? "día restante" : "días restantes"}`,
      className: "bg-muted text-muted-foreground",
    };
  }
  if (state === "active") {
    if (license?.type === "anual") {
      const expiringSoon = typeof daysToExpiry === "number" && daysToExpiry <= 30;
      return {
        label: `Activa — Anual, vence ${license.expires ?? "—"}`,
        className: expiringSoon
          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      };
    }
    return {
      label: "Activa — Perpetua",
      className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    };
  }
  return { label: "Vencida", className: "bg-destructive/10 text-destructive" };
}

function LicenseCard() {
  const { status, isLoading } = useLicense();
  const [showForm, setShowForm] = useState(false);

  const pill = status ? licensePill(status) : null;
  const license = status?.license;

  const licenseRows: { label: string; value: string }[] = license
    ? [
        { label: "Cliente", value: license.customer },
        ...(license.business ? [{ label: "Negocio", value: license.business }] : []),
        { label: "Tipo", value: license.type === "perpetua" ? "Perpetua" : "Anual" },
        { label: "Emitida", value: license.issued },
        ...(license.expires ? [{ label: "Vence", value: license.expires }] : []),
        { label: "ID", value: license.id },
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
            <Skeleton className="h-6 w-32 rounded-full" />
          ) : pill ? (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap",
                pill.className
              )}
            >
              {pill.label}
            </span>
          ) : null
        }
      />

      {licenseRows.length > 0 && (
        <div className="mt-4 rounded-lg border border-border overflow-hidden">
          <div className="divide-y divide-border">
            {licenseRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-4 px-4 py-2.5">
                <span className="text-sm text-muted-foreground shrink-0">{row.label}</span>
                <span className="text-sm font-mono tabular-nums truncate">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", showForm && "rotate-180")}
            strokeWidth={1.75}
          />
          Activar / cambiar licencia
        </button>
        {showForm && (
          <div className="mt-3 max-w-md">
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
        { label: "Versión", value: info.version },
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
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-muted shrink-0">
              <Store className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} />
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight truncate">
              {settings?.business_name || "Mi Negocio"}
            </h2>
            <p className="text-sm text-muted-foreground truncate">
              {settings?.business_address || "Sistema de punto de venta"}
            </p>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Venilu POS</span>
            <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs font-medium font-mono tabular-nums">
              {info ? `v${info.version}` : "—"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
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
            <div className="divide-y divide-border">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ))}
            </div>
          ) : appInfoQuery.isError ? (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
              <Info className="h-4 w-4" strokeWidth={1.75} />
              No se pudo obtener la información del sistema
            </div>
          ) : (
            <div className="divide-y divide-border">
              {systemRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className="text-sm font-mono tabular-nums">{row.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
