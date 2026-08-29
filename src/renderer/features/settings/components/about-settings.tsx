import { useQuery } from "@tanstack/react-query";
import { Info, MonitorCog, Store } from "lucide-react";
import { WidgetHeader } from "@renderer/shared/components/widget-header";
import { Skeleton } from "@components/ui/skeleton";
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
