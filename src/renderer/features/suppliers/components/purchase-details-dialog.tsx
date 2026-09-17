import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Skeleton } from "@components/ui/skeleton";
import { Receipt, Ban, CalendarClock, User, FileText, Tags } from "lucide-react";
import { toast } from "sonner";
import { ipc } from "@lib/ipc";
import { cn } from "@lib/utils";
import { formatCurrency } from "@lib/currency";
import { formatDateTime } from "@lib/formatters";
import { Purchase } from "@shared/types/models";
import { usePermission } from "@renderer/features/auth/hooks/use-permission";
import { PERMISSIONS } from "@shared/permissions";
import { DeleteConfirmDialog } from "@renderer/shared/components/delete-confirm-dialog";
import type { IpcResult } from "../types";

interface PurchaseDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseId: string | null;
  onChanged?: () => void;
}

export const PAYMENT_STATUS_META: Record<Purchase["payment_status"], { label: string; className: string }> = {
  paid: { label: "Pagada", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  partial: { label: "Pago parcial", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  pending: { label: "A crédito", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
};

export function isOverdue(p: Purchase): boolean {
  if (p.status === "cancelled" || p.payment_status === "paid" || !p.due_date) return false;
  return new Date(p.due_date).getTime() < Date.now();
}

/** Fecha de vencimiento sin hora ("5 sept 2026"). */
export function formatDueDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-DO", { day: "numeric", month: "short", year: "numeric" });
}

const BADGE = "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap";
const DANGER_BADGE = "bg-red-500/10 text-red-600 dark:text-red-400";

export function PurchaseDetailsDialog({ open, onOpenChange, purchaseId, onChanged }: PurchaseDetailsDialogProps) {
  const queryClient = useQueryClient();
  const canCancel = usePermission(PERMISSIONS.PUR_CANCEL);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const { data: purchase, isPending, isError } = useQuery({
    queryKey: ["purchase", purchaseId],
    queryFn: async () => {
      const result = (await ipc.invoke("purchases:get", purchaseId)) as IpcResult<Purchase | null>;
      if (!result.success) throw new Error(result.message);
      return result.data ?? null;
    },
    enabled: open && !!purchaseId,
  });

  const handleCancel = async () => {
    if (!purchase) return;
    setCancelling(true);
    try {
      const result = (await ipc.invoke("purchases:cancel", { purchaseId: purchase.id })) as IpcResult<Purchase>;
      if (!result.success) {
        toast.error("No se pudo anular", { description: result.message });
        return;
      }
      toast.success("Compra anulada", { description: "El stock y la cuenta por pagar se revirtieron." });
      window.dispatchEvent(new Event("inventory-updated"));
      window.dispatchEvent(new Event("suppliers-updated"));
      void queryClient.invalidateQueries({ queryKey: ["purchase", purchase.id] });
      onChanged?.();
      setConfirmOpen(false);
    } finally {
      setCancelling(false);
    }
  };

  const outstanding = purchase ? Math.max(0, Number(purchase.total_amount) - Number(purchase.amount_paid || 0)) : 0;
  const overdue = purchase ? isOverdue(purchase) : false;
  const cancelled = purchase?.status === "cancelled";
  const cancellable = !!purchase && purchase.status === "received" && Number(purchase.amount_paid || 0) === 0;
  const items = purchase?.items ?? [];
  const units = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-6 pb-4 border-b border-border shrink-0 space-y-1">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center shrink-0">
                <Receipt className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <DialogTitle className={cn("text-lg font-semibold tracking-tight truncate tabular-nums", cancelled && "line-through text-muted-foreground")}>
                Compra #{purchaseId}
              </DialogTitle>
            </div>
            {purchase && (
              <div className="flex items-center gap-1.5 shrink-0">
                {cancelled ? (
                  <span className={cn(BADGE, DANGER_BADGE)}>
                    <Ban className="h-3 w-3" strokeWidth={2} aria-hidden="true" />Anulada
                  </span>
                ) : (
                  <span className={cn(BADGE, PAYMENT_STATUS_META[purchase.payment_status].className)}>
                    {PAYMENT_STATUS_META[purchase.payment_status].label}
                  </span>
                )}
                {overdue && (
                  <span className={cn(BADGE, DANGER_BADGE)} title={`Venció el ${formatDueDate(purchase.due_date)}`}>
                    <CalendarClock className="h-3 w-3" strokeWidth={2} aria-hidden="true" />Vencida
                  </span>
                )}
              </div>
            )}
          </div>
          <DialogDescription className="text-sm text-muted-foreground truncate" title={purchase ? `${purchase.supplier_name} · ${formatDateTime(purchase.created_at)}` : undefined}>
            {purchase ? `${purchase.supplier_name} · ${formatDateTime(purchase.created_at)}` : "Detalle de la compra"}
          </DialogDescription>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-4">
          {isError ? (
            <div role="alert" className="px-3.5 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive text-center">No se pudo cargar la compra. Cierra e inténtalo de nuevo.</p>
            </div>
          ) : isPending || !purchase ? (
            <div className="space-y-3" aria-busy="true" aria-label="Cargando compra">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="rounded-lg border border-border p-3 min-w-0">
                  <dt className="text-xs text-muted-foreground flex items-center gap-1"><FileText className="h-3 w-3" aria-hidden="true" />Factura</dt>
                  <dd className="font-medium truncate mt-0.5" title={purchase.invoice_number || undefined}>{purchase.invoice_number || "—"}</dd>
                </div>
                <div className="rounded-lg border border-border p-3 min-w-0">
                  <dt className="text-xs text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" aria-hidden="true" />Registró</dt>
                  <dd className="font-medium truncate mt-0.5" title={purchase.username || undefined}>{purchase.username || "—"}</dd>
                </div>
                <div className="rounded-lg border border-border p-3 min-w-0">
                  <dt className="text-xs text-muted-foreground flex items-center gap-1"><CalendarClock className="h-3 w-3" aria-hidden="true" />Vence</dt>
                  <dd className={cn("font-medium truncate mt-0.5", overdue && "text-red-600 dark:text-red-400")}>{purchase.due_date ? formatDueDate(purchase.due_date) : "De contado"}</dd>
                </div>
                <div className="rounded-lg border border-border p-3 min-w-0">
                  <dt className="text-xs text-muted-foreground flex items-center gap-1"><Tags className="h-3 w-3" aria-hidden="true" />Costos</dt>
                  <dd className="font-medium truncate mt-0.5">{purchase.updated_costs ? "Actualizados" : "Sin cambio"}</dd>
                </div>
              </dl>

              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <caption className="sr-only">Productos de la compra</caption>
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th scope="col" className="text-left font-medium px-3 py-2">Producto</th>
                      <th scope="col" className="text-right font-medium px-3 py-2">Cant.</th>
                      <th scope="col" className="text-right font-medium px-3 py-2">Costo unit.</th>
                      <th scope="col" className="text-right font-medium px-3 py-2">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2 max-w-[300px]">
                          <p className="font-medium truncate" title={item.product_name}>{item.product_name}</p>
                          {item.previous_cost != null && Number(item.previous_cost) !== Number(item.unit_cost) && (
                            <p className="text-xs text-muted-foreground tabular-nums">Costo anterior {formatCurrency(Number(item.previous_cost))}</p>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{item.quantity}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap">{formatCurrency(Number(item.unit_cost))}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap">{formatCurrency(Number(item.total_cost))}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <td className="px-3 py-1.5" colSpan={4}>
                        <span className="tabular-nums">{units} uds · {items.length} producto{items.length !== 1 ? "s" : ""}</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="rounded-lg border border-border divide-y divide-border text-sm">
                <div className="flex justify-between px-3.5 py-2 bg-muted/40"><span className="font-semibold">Total</span><span className={cn("font-mono font-semibold tabular-nums", cancelled && "line-through text-muted-foreground")}>{formatCurrency(Number(purchase.total_amount))}</span></div>
                <div className="flex justify-between px-3.5 py-2"><span className="text-muted-foreground">Pagado</span><span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(Number(purchase.amount_paid || 0))}</span></div>
                <div className="flex justify-between px-3.5 py-2"><span className="text-muted-foreground">Pendiente</span><span className={cn("font-mono tabular-nums", !cancelled && outstanding > 0 && "text-amber-600 dark:text-amber-400 font-semibold")}>{cancelled ? "—" : formatCurrency(outstanding)}</span></div>
              </div>

              {purchase.notes && (
                <div className="rounded-lg bg-muted/40 px-3.5 py-2.5">
                  <p className="text-xs font-medium text-muted-foreground mb-0.5">Nota</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap break-words">{purchase.notes}</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-6 pt-4 border-t border-border flex items-center gap-3 shrink-0">
          {canCancel && cancellable && (
            <Button variant="ghost" onClick={() => setConfirmOpen(true)} disabled={cancelling} className="h-10 text-destructive hover:text-destructive hover:bg-destructive/10">
              <Ban className="h-4 w-4" strokeWidth={1.75} />
              Anular compra
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 h-10">Cerrar</Button>
        </div>

        <DeleteConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="¿Anular esta compra?"
          description={<>Se descontará del inventario la mercancía de la compra <strong>#{purchase?.id}</strong> y se eliminará su cuenta por pagar. Solo es posible si aún no se ha vendido nada de ella.</>}
          confirmLabel="Anular compra"
          isLoading={cancelling}
          onConfirm={handleCancel}
        />
      </DialogContent>
    </Dialog>
  );
}
