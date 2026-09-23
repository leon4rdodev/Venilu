import { useState, useEffect } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@components/ui/table";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Plus, Search, X, Receipt, Eye, Ban, CalendarClock } from "lucide-react";
import { WidgetHeader } from "@renderer/shared/components/widget-header";
import { TablePagination } from "@renderer/shared/components/table-pagination";
import { TableSkeletonRows } from "@renderer/shared/components/table-skeleton";
import { EmptyStateRow } from "@renderer/shared/components/empty-state";
import { usePermission } from "@renderer/features/auth/hooks/use-permission";
import { PERMISSIONS } from "@shared/permissions";
import { Purchase, Supplier } from "@shared/types/models";
import { ipc } from "@lib/ipc";
import { cn } from "@lib/utils";
import { formatCurrency } from "@lib/currency";
import { formatDateTime } from "@lib/formatters";
import { PurchaseDialog } from "./purchase-dialog";
import { PurchaseDetailsDialog, PAYMENT_STATUS_META, isOverdue, formatDueDate } from "./purchase-details-dialog";
import type { IpcResult, PurchaseListResult } from "../types";

type PayFilter = "all" | "pending" | "paid" | "cancelled";
const FILTERS: { value: PayFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Por pagar" },
  { value: "paid", label: "Pagadas" },
  { value: "cancelled", label: "Anuladas" },
];
const PAGE_SIZE = 15;

interface PurchasesTableProps {
  /** Si se pasa, la tabla se limita a ese suplidor (ficha). */
  supplier?: Supplier | null;
  compact?: boolean;
}

export function PurchasesTable({ supplier = null, compact = false }: PurchasesTableProps) {
  const canCreate = usePermission(PERMISSIONS.PUR_CREATE);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PayFilter>("all");
  const [debounced, setDebounced] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebounced(search.trim()), 300); return () => clearTimeout(t); }, [search]);

  const key = JSON.stringify([debounced, filter, supplier?.id ?? null]);
  const [paging, setPaging] = useState({ key, page: 1 });
  if (paging.key !== key) setPaging({ key, page: 1 });
  const page = paging.key === key ? paging.page : 1;

  const query = useQuery({
    queryKey: ["purchases-list", { page, search: debounced, filter, supplierId: supplier?.id ?? null }],
    queryFn: async () => {
      const result = (await ipc.invoke("purchases:list", {
        page, pageSize: PAGE_SIZE, search: debounced, supplierId: supplier?.id,
        status: filter === "cancelled" ? "cancelled" : filter === "all" ? undefined : "received",
        paymentStatus: filter === "paid" ? "paid" : undefined,
      })) as IpcResult<PurchaseListResult>;
      if (!result.success || !result.data) throw new Error(result.message || "No se pudieron cargar las compras");
      // "Por pagar" = pendientes + parciales (el servidor filtra un solo estado)
      if (filter === "pending") {
        return { ...result.data, items: result.data.items.filter((p) => p.payment_status !== "paid") };
      }
      return result.data;
    },
    placeholderData: keepPreviousData,
  });
  const data = query.data ?? { items: [] as Purchase[], total: 0, totalPages: 1 };

  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const colCount = supplier ? 6 : 7;

  return (
    <div className={cn("bg-card border border-border rounded-lg space-y-3", compact ? "p-4" : "p-5")}>
      <WidgetHeader
        icon={Receipt}
        title={supplier ? "Compras" : "Historial de Compras"}
        subtitle={`${data.total} compra${data.total !== 1 ? "s" : ""}`}
        action={canCreate ? (
          <Button onClick={() => setCreateOpen(true)} size="sm" className="h-9">
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            Nueva Compra
          </Button>
        ) : undefined}
      />

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <div className="relative w-88 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
          <Input type="search" aria-label="Buscar compra" placeholder={supplier ? "Buscar por # o factura..." : "Buscar por #, suplidor o factura..."} value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 pl-9 pr-8 bg-background" />
          {search && (
            <button type="button" onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-muted transition-colors" title="Limpiar búsqueda" aria-label="Limpiar búsqueda">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "px-3 h-9 rounded-full border text-xs font-medium transition-colors whitespace-nowrap",
                filter === f.value ? "bg-foreground text-background border-foreground" : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b border-border">
              <TableHead className="text-xs font-medium text-muted-foreground">Fecha</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground">Compra</TableHead>
              {!supplier && <TableHead className="text-xs font-medium text-muted-foreground">Suplidor</TableHead>}
              <TableHead className="text-xs font-medium text-muted-foreground text-right">Total</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground text-right">Pendiente</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground text-center">Estado</TableHead>
              <TableHead className="text-xs font-medium text-muted-foreground text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isPending ? (
              <TableSkeletonRows rows={5} cols={colCount} />
            ) : data.items.length === 0 ? (
              <EmptyStateRow icon={Receipt} title={debounced || filter !== "all" ? "No se encontraron compras" : "No hay compras registradas"} description={debounced || filter !== "all" ? "Ajusta la búsqueda o el filtro" : "Registra la primera compra para que la mercancía entre al inventario"} colSpan={colCount} />
            ) : data.items.map((p) => {
              const outstanding = Math.max(0, Number(p.total_amount) - Number(p.amount_paid || 0));
              const overdue = isOverdue(p);
              const cancelled = p.status === "cancelled";
              const statusLabel = PAYMENT_STATUS_META[p.payment_status].label;
              return (
                <TableRow key={p.id} className={cn("hover:bg-muted/40 transition-colors cursor-pointer", cancelled && "text-muted-foreground")} onClick={() => setDetailId(p.id)}>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap tabular-nums">{formatDateTime(p.created_at)}</TableCell>
                  <TableCell>
                    <p className={cn("text-sm font-medium font-mono tabular-nums", cancelled && "line-through")}>#{p.id}</p>
                    {p.invoice_number && <p className="text-xs text-muted-foreground truncate max-w-[160px]" title={`Factura ${p.invoice_number}`}>Fact. {p.invoice_number}</p>}
                  </TableCell>
                  {!supplier && (
                    <TableCell className="text-sm max-w-[220px]">
                      <p className="truncate" title={p.supplier_name}>{p.supplier_name}</p>
                    </TableCell>
                  )}
                  <TableCell className={cn("text-right font-mono text-sm tabular-nums whitespace-nowrap", cancelled && "line-through")}>{formatCurrency(Number(p.total_amount))}</TableCell>
                  <TableCell className={cn("text-right font-mono text-sm tabular-nums whitespace-nowrap", outstanding > 0 && !cancelled ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground/50")}>
                    {cancelled ? "—" : outstanding > 0 ? formatCurrency(outstanding) : "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {cancelled ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-red-500/10 text-red-600 dark:text-red-400" title="Compra anulada: stock y cuenta por pagar revertidos">
                        <Ban className="h-3 w-3" strokeWidth={2} aria-hidden="true" />Anulada
                      </span>
                    ) : overdue ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap bg-red-500/10 text-red-600 dark:text-red-400" title={`${statusLabel} · venció el ${p.due_date ? formatDueDate(p.due_date) : ""}`.trim()}>
                        <CalendarClock className="h-3 w-3" strokeWidth={2} aria-hidden="true" />Vencida
                      </span>
                    ) : (
                      <span className={cn("inline-flex px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap", PAYMENT_STATUS_META[p.payment_status].className)} title={p.due_date && p.payment_status !== "paid" ? `Vence el ${formatDueDate(p.due_date)}` : undefined}>
                        {statusLabel}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={(e) => { e.stopPropagation(); setDetailId(p.id); }} title="Ver detalle" aria-label={`Ver detalle de la compra #${p.id}`}>
                      <Eye className="h-4 w-4" strokeWidth={1.75} />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <TablePagination page={page} totalPages={data.totalPages} pageSize={PAGE_SIZE} totalItems={data.total} onPageChange={(p) => setPaging({ key, page: p })} />

      <PurchaseDialog open={createOpen} onOpenChange={setCreateOpen} supplier={supplier} onCreated={() => void query.refetch()} />
      <PurchaseDetailsDialog open={!!detailId} onOpenChange={(o) => { if (!o) setDetailId(null); }} purchaseId={detailId} onChanged={() => void query.refetch()} />
    </div>
  );
}
