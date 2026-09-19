import { useEffect, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { AlertTriangle, History, Search, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@components/ui/table";
import { Input } from "@components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/ui/select";
import { WidgetHeader } from "@renderer/shared/components/widget-header";
import { TablePagination } from "@renderer/shared/components/table-pagination";
import { TableSkeletonRows } from "@renderer/shared/components/table-skeleton";
import { useMinimumLoading } from "@hooks/use-minimum-loading";
import { AuditLogEntry } from "@shared/types/models";

const PAGE_SIZE = 15;
const ALL_ACTIONS = "__all__";

/** Spanish labels for known audit action identifiers; fallback shows the raw id. */
const ACTION_LABELS: Record<string, string> = {
  "backup:restore": "Restauró backup",
  "backup:delete": "Eliminó backup",
  "backup:export": "Exportó backup",
  "users:delete": "Eliminó usuario",
  "roles:delete": "Eliminó rol",
  "inventory:delete": "Eliminó producto",
  "inventory:create": "Creó producto",
  "inventory:update": "Editó producto",
  "inventory:update_price": "Cambió precio",
  "inventory:adjust_stock": "Ajustó stock",
  "inventory:archive": "Archivó producto",
  "inventory:restore": "Restauró producto",
  "sales:void": "Anuló venta",
  "sales:return": "Devolución de artículos",
  "customers:pay_debt": "Registró abono",
  "customers:delete": "Eliminó cliente",
  "users:create": "Creó usuario",
  "users:update": "Editó usuario",
  "roles:create": "Creó rol",
  "roles:update": "Editó rol",
  "shifts:open": "Abrió turno",
  "shifts:close": "Cerró turno",
  "shifts:expense": "Salida de caja",
  "shifts:force_close": "Cierre forzado de turno",
  "settings:update": "Cambió ajustes",
  "suppliers:create": "Creó suplidor",
  "suppliers:update": "Editó suplidor",
  "suppliers:delete": "Eliminó suplidor",
  "suppliers:deactivate": "Desactivó suplidor",
  "suppliers:pay": "Pagó a suplidor",
  "purchases:create": "Registró compra",
  "purchases:cancel": "Anuló compra",
  "fiscal:save-sequence": "Guardó secuencia NCF",
  "fiscal:delete-sequence": "Eliminó secuencia NCF",
  "license:activate": "Activó licencia",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

/** "Hoy HH:mm" / "Ayer HH:mm" / "dd MMM yyyy HH:mm" */
// Accepts Date too: IPC structured-clone delivers entity dates as Date objects.
function formatAuditDate(value: string | Date): string {
  const date = value instanceof Date
    ? value
    : new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (isNaN(date.getTime())) return "—";

  const time = date.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit", hour12: false });
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(date, today)) return `Hoy ${time}`;
  if (sameDay(date, yesterday)) return `Ayer ${time}`;
  return `${date.toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" })} ${time}`;
}

interface AuditListResult {
  items: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function ActivitySettings() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<string>(ALL_ACTIONS);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Debounced search — resets to page 1 whenever the term settles
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const actionFilter = action === ALL_ACTIONS ? undefined : action;

  const listQuery = useQuery({
    queryKey: ["audit-log", page, actionFilter ?? "", search],
    queryFn: async () => {
      const result = (await window.ipcRenderer.invoke("audit:list", {
        page,
        pageSize: PAGE_SIZE,
        action: actionFilter,
        search: search || undefined,
      })) as { success: boolean; data?: AuditListResult; message?: string };
      if (!result.success || !result.data) {
        throw new Error(result.message || "Error al cargar el registro de actividad");
      }
      return result.data;
    },
    placeholderData: keepPreviousData,
  });

  const actionsQuery = useQuery({
    queryKey: ["audit-actions"],
    queryFn: async () => {
      const result = (await window.ipcRenderer.invoke("audit:actions")) as {
        success: boolean;
        data?: string[];
        message?: string;
      };
      if (!result.success || !result.data) {
        throw new Error(result.message || "Error al cargar acciones");
      }
      return result.data;
    },
    staleTime: 60_000,
  });

  const showSkeleton = useMinimumLoading(listQuery.isPending, 500);

  const data = listQuery.data;
  const items = data?.items ?? [];
  const hasFilters = search !== "" || actionFilter !== undefined;

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-4">
      <WidgetHeader
        icon={History}
        title="Registro de Actividad"
        subtitle="Acciones sensibles realizadas por los usuarios del sistema"
      />

      {/* Toolbar: search + action filter */}
      <div
        role="search"
        aria-label="Filtrar registro de actividad"
        className="flex flex-wrap items-center gap-2 border-t border-border pt-4"
      >
        <div className="relative w-64 shrink-0">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label="Buscar por usuario o detalle"
            placeholder="Buscar usuario o detalle…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-9 pl-9 pr-8 bg-background [&::-webkit-search-cancel-button]:hidden"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              aria-label="Limpiar búsqueda"
              title="Limpiar búsqueda"
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="flex-1 min-w-2" />

        <Select
          value={action}
          onValueChange={(v) => {
            setAction(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-[200px] bg-background" aria-label="Filtrar por acción">
            <SelectValue placeholder="Todas las acciones" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_ACTIONS}>Todas las acciones</SelectItem>
            {(actionsQuery.data ?? []).map((a) => (
              <SelectItem key={a} value={a}>
                {actionLabel(a)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div
        className="rounded-lg border border-border overflow-hidden"
        aria-busy={listQuery.isFetching || undefined}
      >
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border">
              <TableHead className="text-xs font-medium text-muted-foreground w-[170px]">Fecha</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">Usuario</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">Acción</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showSkeleton ? (
              <TableSkeletonRows rows={6} cols={4} />
            ) : listQuery.isError ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4}>
                  <div role="alert" className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
                      <AlertTriangle className="h-6 w-6 text-destructive" strokeWidth={1.5} aria-hidden="true" />
                    </div>
                    <p className="text-sm font-medium text-foreground">No se pudo cargar el registro</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {listQuery.error instanceof Error
                        ? listQuery.error.message
                        : "Intenta de nuevo en unos segundos"}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4}>
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                      <History className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.5} aria-hidden="true" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {hasFilters ? "Sin resultados" : "Sin actividad registrada"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {hasFilters
                        ? "Intenta ajustar la búsqueda o el filtro de acción"
                        : "Las acciones sensibles aparecerán aquí"}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              items.map((entry) => (
                <TableRow key={entry.id} className="hover:bg-muted/40 transition-colors">
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap tabular-nums">
                    {formatAuditDate(entry.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        aria-hidden="true"
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground text-xs font-semibold shrink-0 select-none"
                      >
                        {(entry.username || "?").charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium truncate" title={entry.username}>
                        {entry.username}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs font-medium whitespace-nowrap"
                      title={entry.action}
                    >
                      {actionLabel(entry.action)}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[260px]">
                    <span
                      className="block text-sm text-muted-foreground truncate"
                      title={entry.target_label ?? undefined}
                    >
                      {entry.target_label || <span className="text-muted-foreground/50" aria-label="Sin detalle">—</span>}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        page={data?.page ?? page}
        totalPages={data?.totalPages ?? 1}
        pageSize={PAGE_SIZE}
        totalItems={data?.total ?? 0}
        onPageChange={setPage}
      />
    </div>
  );
}
