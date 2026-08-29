import { useEffect, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { History } from "lucide-react";
import { Dialog, DialogContent } from "@components/ui/dialog";
import { Skeleton } from "@components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@components/ui/table";
import { TablePagination } from "@renderer/shared/components/table-pagination";
import { useMinimumLoading } from "@renderer/shared/hooks/use-minimum-loading";
import { cn } from "@lib/utils";
import { Product, StockMovementEntry } from "@shared/types/models";

const PAGE_SIZE = 15;

/** Spanish labels for kardex movement types. */
const TYPE_LABELS: Record<StockMovementEntry["type"], string> = {
  sale: "Venta",
  void: "Anulación",
  adjustment: "Ajuste",
  initial: "Inicial",
  return: "Devolución",
};

/** "Hoy HH:mm" / "Ayer HH:mm" / "dd MMM yyyy, HH:mm" */
// IPC structured-clone delivers TypeORM dates as REAL Date objects, not
// strings — accept both (calling .includes on a Date was crashing the render).
function formatMovementDate(value: string | Date): string {
  const date = value instanceof Date
    ? value
    : new Date(typeof value === "string" && !value.includes("T") ? value.replace(" ", "T") : value);
  if (isNaN(date.getTime())) return "—";

  const time = date.toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit", hour12: false });
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(date, today)) return `Hoy ${time}`;
  if (sameDay(date, yesterday)) return `Ayer ${time}`;
  return `${date.toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" })}, ${time}`;
}

/** Detail cell: note, sale reference (sale/void) and username, dot-separated. */
function movementDetail(m: StockMovementEntry): string {
  const parts: string[] = [];
  if (m.note) parts.push(m.note);
  if ((m.type === "sale" || m.type === "void") && m.reference) parts.push(`Venta #${m.reference}`);
  if (m.username) parts.push(m.username);
  return parts.join(" · ");
}

interface MovementsListResult {
  items: StockMovementEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface StockMovementsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}

/**
 * Kardex — paginated history of stock movements for one product.
 * Read-only; available to anyone with access to the inventory module.
 */
export function StockMovementsDialog({ open, onOpenChange, product }: StockMovementsDialogProps) {
  const [page, setPage] = useState(1);

  // Fresh page whenever the dialog opens or targets another product
  useEffect(() => {
    if (open) setPage(1);
  }, [open, product?.id]);

  const movementsQuery = useQuery({
    queryKey: ["stock-movements", product?.id, page],
    queryFn: async () => {
      const result = (await window.ipcRenderer.invoke("get-stock-movements", {
        productId: product!.id,
        page,
        pageSize: PAGE_SIZE,
      })) as { success: boolean; data?: MovementsListResult; message?: string };
      if (!result.success || !result.data) {
        throw new Error(result.message || "Error al cargar los movimientos");
      }
      return result.data;
    },
    enabled: open && !!product,
    placeholderData: keepPreviousData,
  });

  const showSkeleton = useMinimumLoading(open && movementsQuery.isPending, 500);

  if (!product) return null;

  const data = movementsQuery.data;
  const items = data?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 overflow-hidden sm:max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border space-y-1 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center shrink-0">
              <History className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">Movimientos de Stock</h2>
          </div>
          <p className="text-sm text-muted-foreground truncate" title={product.name}>
            {product.name} · Stock actual:{" "}
            <span className="font-mono font-medium tabular-nums text-foreground">{product.stock}</span>
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-3 flex-1 overflow-y-auto min-h-0">
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border">
                  <TableHead className="text-xs font-medium text-muted-foreground w-[150px]">Fecha</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Tipo</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground text-right">Cambio</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground text-right">Stock</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border">
                {showSkeleton ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i} className="hover:bg-transparent">
                      <TableCell className="py-3">
                        <Skeleton className="h-4 w-24" />
                      </TableCell>
                      <TableCell className="py-3">
                        <Skeleton className="h-6 w-16 rounded-full" />
                      </TableCell>
                      <TableCell className="py-3">
                        <Skeleton className="h-4 w-8 ml-auto" />
                      </TableCell>
                      <TableCell className="py-3">
                        <Skeleton className="h-4 w-8 ml-auto" />
                      </TableCell>
                      <TableCell className="py-3">
                        <Skeleton className="h-3.5 w-32" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : movementsQuery.isError ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5}>
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <p className="text-sm text-destructive">Error al cargar los movimientos</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {movementsQuery.error instanceof Error ? movementsQuery.error.message : "Intenta de nuevo"}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={5}>
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                          <History className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.5} />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">Sin movimientos registrados</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Las ventas y ajustes de este producto aparecerán aquí
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((movement) => {
                    const detail = movementDetail(movement);
                    return (
                      <TableRow key={movement.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="py-3 text-sm text-muted-foreground whitespace-nowrap tabular-nums">
                          {formatMovementDate(movement.created_at)}
                        </TableCell>
                        <TableCell className="py-3">
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs font-medium whitespace-nowrap">
                            {TYPE_LABELS[movement.type] ?? movement.type}
                          </span>
                        </TableCell>
                        <TableCell
                          className={cn(
                            "py-3 text-right font-mono text-sm font-medium tabular-nums whitespace-nowrap",
                            movement.quantity_delta > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : movement.quantity_delta < 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-muted-foreground"
                          )}
                        >
                          {movement.quantity_delta > 0 ? `+${movement.quantity_delta}` : movement.quantity_delta}
                        </TableCell>
                        <TableCell className="py-3 text-right font-mono text-sm tabular-nums whitespace-nowrap">
                          {movement.stock_after}
                        </TableCell>
                        <TableCell className="py-3 max-w-[200px]">
                          <span className="block text-xs text-muted-foreground truncate" title={detail || undefined}>
                            {detail || <span className="text-muted-foreground/50">—</span>}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
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
      </DialogContent>
    </Dialog>
  );
}
