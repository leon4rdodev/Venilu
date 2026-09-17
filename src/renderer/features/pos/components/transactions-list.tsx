import { useEffect, useRef, useState } from "react";
import {
  Search,
  X,
  Banknote,
  CreditCard,
  ArrowRightLeft,
  HandCoins,
  Receipt,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  FilterX,
} from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Skeleton } from "@components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/ui/select";
import { DateRangePicker } from "@components/ui/date-range-picker";
import { ipc } from "@lib/ipc";
import { formatCurrency } from "@lib/currency";
import { formatDateTime } from "@lib/formatters";
import { cn } from "@lib/utils";
import type { PaymentMethod, Sale, SaleStatus } from "@shared/types/models";
import { useShift } from "../hooks/use-shift";
import { TransactionDetailsDialog } from "./transaction-details-dialog";

const PAGE_SIZE = 25;

/** Sticky column header: hairline via inset shadow so it survives scrolling. */
const TH_CLASS =
  "sticky top-0 z-10 bg-background pb-2 pr-3 font-medium whitespace-nowrap shadow-[inset_0_-1px_0_0_var(--border)]";

type MethodFilter = PaymentMethod | "all";
type StatusFilter = SaleStatus | "all";

interface SalesPage {
  items: Sale[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface GetSalesResponse {
  success: boolean;
  data?: SalesPage;
  message?: string;
}

interface TransactionsListProps {
  /** Bumped by the parent to force a refetch (e.g. header refresh button). */
  refreshKey?: number;
}

const methodMeta: Record<
  PaymentMethod,
  { label: string; icon: typeof Banknote; color: string }
> = {
  cash: {
    label: "Efectivo",
    icon: Banknote,
    color: "text-emerald-600 dark:text-emerald-400",
  },
  card: { label: "Tarjeta", icon: CreditCard, color: "text-muted-foreground" },
  transfer: {
    label: "Transferencia",
    icon: ArrowRightLeft,
    color: "text-muted-foreground",
  },
  credit: {
    label: "Crédito",
    icon: HandCoins,
    color: "text-amber-600 dark:text-amber-400",
  },
};

const statusMeta: Record<SaleStatus, { label: string; cls: string }> = {
  paid: {
    label: "Completada",
    cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  credit: {
    label: "Crédito",
    cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  partial: {
    label: "Parcial",
    cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  voided: {
    label: "Anulada",
    cls: "bg-red-500/10 text-red-600 dark:text-red-400",
  },
};

export function TransactionsList({ refreshKey = 0 }: TransactionsListProps) {
  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [method, setMethod] = useState<MethodFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [page, setPage] = useState(1);

  // Data
  const [items, setItems] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const requestIdRef = useRef(0);

  // Details dialog
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { fetchActiveShift } = useShift();

  // Debounce search input (300ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Any filter change resets to page 1 (skip initial mount)
  const skipFilterResetRef = useRef(true);
  useEffect(() => {
    if (skipFilterResetRef.current) {
      skipFilterResetRef.current = false;
      return;
    }
    setPage(1);
  }, [debouncedSearch, method, status, dateRange]);

  // Fetch — guarded against out-of-order responses via requestIdRef
  useEffect(() => {
    const reqId = ++requestIdRef.current;

    const run = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const payload: {
          page: number;
          pageSize: number;
          search?: string;
          method?: PaymentMethod;
          status?: SaleStatus;
          startDate?: string;
          endDate?: string;
        } = { page, pageSize: PAGE_SIZE };

        const trimmed = debouncedSearch.trim();
        if (trimmed) payload.search = trimmed;
        if (method !== "all") payload.method = method;
        if (status !== "all") payload.status = status;
        if (dateRange?.from) {
          const start = new Date(dateRange.from);
          start.setHours(0, 0, 0, 0);
          payload.startDate = start.toISOString();
        }
        if (dateRange?.to) {
          const end = new Date(dateRange.to);
          end.setHours(23, 59, 59, 999);
          payload.endDate = end.toISOString();
        }

        const result = (await ipc.invoke(
          "get-sales",
          payload,
        )) as GetSalesResponse;

        if (requestIdRef.current !== reqId) return;

        if (result.success && result.data) {
          setItems(result.data.items);
          setTotal(result.data.total);
          setTotalPages(result.data.totalPages);
        } else {
          setError(result.message || "Error al cargar las transacciones");
        }
      } catch (err) {
        console.error("Error fetching sales:", err);
        if (requestIdRef.current === reqId) {
          setError("Error de conexión al cargar las transacciones");
        }
      } finally {
        if (requestIdRef.current === reqId) {
          setIsLoading(false);
        }
      }
    };

    void run();
  }, [page, debouncedSearch, method, status, dateRange, refreshKey, reloadKey]);

  const hasActiveFilters =
    search !== "" ||
    method !== "all" ||
    status !== "all" ||
    Boolean(dateRange?.from);

  const clearFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setMethod("all");
    setStatus("all");
    setDateRange(undefined);
    setPage(1);
  };

  const openDetails = (sale: Sale) => {
    setSelectedSale(sale);
    setDialogOpen(true);
  };

  const rangeFrom = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeTo = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <div role="search" className="relative flex-1 min-w-[220px] max-w-sm">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por ID o cliente..."
            aria-label="Buscar transacciones por ID o cliente"
            className="h-9 bg-background pl-8 pr-8"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            </button>
          )}
        </div>

        <Select
          value={method}
          onValueChange={(v) => setMethod(v as MethodFilter)}
        >
          <SelectTrigger className="h-9 w-[160px] bg-background" aria-label="Filtrar por método de pago">
            <SelectValue placeholder="Método" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los métodos</SelectItem>
            <SelectItem value="cash">Efectivo</SelectItem>
            <SelectItem value="card">Tarjeta</SelectItem>
            <SelectItem value="transfer">Transferencia</SelectItem>
            <SelectItem value="credit">Crédito</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={status}
          onValueChange={(v) => setStatus(v as StatusFilter)}
        >
          <SelectTrigger className="h-9 w-[160px] bg-background" aria-label="Filtrar por estado">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="paid">Completada</SelectItem>
            <SelectItem value="credit">Crédito</SelectItem>
            <SelectItem value="partial">Parcial</SelectItem>
            <SelectItem value="voided">Anulada</SelectItem>
          </SelectContent>
        </Select>

        <DateRangePicker
          dateRange={dateRange ?? { from: undefined }}
          onDateRangeChange={setDateRange}
          className="shrink-0"
        />

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 text-muted-foreground hover:text-foreground"
            onClick={clearFilters}
          >
            <FilterX className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} />
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1">
        {isLoading ? (
          <div
            role="status"
            aria-live="polite"
            aria-label="Cargando transacciones"
            className="divide-y divide-border pt-1"
          >
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-24 ml-auto" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div role="alert" className="flex flex-col items-center justify-center gap-4 py-16">
            <div className="text-center space-y-1">
              <p className="text-sm font-medium">
                Error al cargar las transacciones
              </p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReloadKey((k) => k + 1)}
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} />
              Reintentar
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div role="status" className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-3">
              <Receipt
                className="h-6 w-6 text-muted-foreground/50"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </div>
            <p className="text-sm font-medium">
              {hasActiveFilters
                ? "Sin resultados"
                : "No hay transacciones registradas"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {hasActiveFilters
                ? "Prueba ajustando o limpiando los filtros"
                : "Las ventas aparecerán aquí al registrarlas"}
            </p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={clearFilters}
              >
                <FilterX className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                Limpiar filtros
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full text-left border-separate border-spacing-0">
            <caption className="sr-only">
              Transacciones registradas, {total} en total. Pulsa una fila para ver el detalle.
            </caption>
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th scope="col" className={TH_CLASS}>Fecha / Hora</th>
                <th scope="col" className={TH_CLASS}>ID</th>
                <th scope="col" className={TH_CLASS}>Cliente</th>
                <th scope="col" className={TH_CLASS}>Cajero</th>
                <th scope="col" className={TH_CLASS}>Método</th>
                <th scope="col" className={TH_CLASS}>Estado</th>
                <th scope="col" className={cn(TH_CLASS, "pr-0 text-right")}>Total</th>
              </tr>
            </thead>
            <tbody className="[&>tr>td]:border-b [&>tr>td]:border-border">
              {items.map((sale) => {
                const mMeta = methodMeta[sale.payment_method] ?? {
                  label: sale.payment_method,
                  icon: Receipt,
                  color: "text-muted-foreground",
                };
                const sMeta = statusMeta[sale.status] ?? {
                  label: sale.status,
                  cls: "bg-muted text-muted-foreground",
                };
                const MethodIcon = mMeta.icon;
                const isVoided = sale.status === "voided";
                const customerName =
                  sale.customer?.name ?? sale.customer_name ?? null;

                return (
                  <tr
                    key={sale.id}
                    tabIndex={0}
                    onClick={() => openDetails(sale)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openDetails(sale);
                      }
                    }}
                    aria-label={`Ver detalle de la venta #${sale.id}`}
                    className="hover:bg-muted/40 cursor-pointer transition-colors outline-none focus-visible:bg-muted/60 focus-visible:outline-1 focus-visible:outline-ring focus-visible:-outline-offset-1"
                  >
                    <td className="py-2.5 pr-3 text-sm text-muted-foreground whitespace-nowrap tabular-nums">
                      {formatDateTime(sale.sale_date || sale.created_at)}
                    </td>
                    <td className="py-2.5 pr-3 text-sm font-medium whitespace-nowrap tabular-nums">
                      #{sale.id}
                    </td>
                    <td className="py-2.5 pr-3 text-sm max-w-[180px]">
                      {customerName ? (
                        <span className="block truncate" title={customerName}>
                          {customerName}
                        </span>
                      ) : (
                        <span className="text-muted-foreground" aria-label="Sin cliente">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-sm text-muted-foreground max-w-[140px]">
                      <span className="block truncate" title={sale.user?.name ?? "Sin cajero"}>
                        {sale.user?.name ?? "—"}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground whitespace-nowrap">
                        <MethodIcon
                          className={cn("h-4 w-4 shrink-0", mMeta.color)}
                          strokeWidth={1.75}
                          aria-hidden="true"
                        />
                        {mMeta.label}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap",
                          sMeta.cls,
                        )}
                      >
                        {sMeta.label}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "py-2.5 text-right font-mono text-sm font-medium tabular-nums whitespace-nowrap",
                        isVoided && "line-through text-muted-foreground",
                      )}
                    >
                      {formatCurrency(sale.total_amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {!isLoading && !error && total > 0 && (
        <nav
          aria-label="Paginación de transacciones"
          className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border shrink-0"
        >
          <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
            Mostrando {rangeFrom}–{rangeTo} de {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={page <= 1}
              aria-label="Página anterior"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums" aria-current="page">
              Página {page} de {Math.max(totalPages, 1)}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              disabled={page >= totalPages}
              aria-label="Página siguiente"
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </Button>
          </div>
        </nav>
      )}

      <TransactionDetailsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        transaction={selectedSale}
        onVoidSuccess={() => {
          // Refresh the list AND the live shift context so expected cash stays accurate.
          setReloadKey((k) => k + 1);
          void fetchActiveShift();
        }}
      />
    </div>
  );
}
