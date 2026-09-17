import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { PauseCircle, Trash2, User2, Play } from "lucide-react";
import { formatCurrency } from "@lib/currency";
import { formatTime } from "@lib/formatters";
import type { ParkedSale } from "../hooks/use-cart";

interface ParkedSalesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parkedSales: ParkedSale[];
  onResume: (id: string) => void;
  onRemove: (id: string) => void;
}

/** List of on-hold tickets: resume or discard, mature-POS style. */
export function ParkedSalesDialog({ open, onOpenChange, parkedSales, onResume, onRemove }: ParkedSalesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 gap-1 text-left border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center shrink-0" aria-hidden="true">
              <PauseCircle className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <DialogTitle className="tracking-tight">Ventas en Espera</DialogTitle>
          </div>
          <DialogDescription>
            Tickets aparcados para atender a otro cliente sin perder la venta.
          </DialogDescription>
        </DialogHeader>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 py-2 pb-4">
          {parkedSales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                <PauseCircle className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No hay ventas en espera</p>
              <p className="text-xs text-muted-foreground mt-1">
                Usa el botón de pausa del carrito para aparcar un ticket.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {parkedSales.map((entry) => {
                const total = entry.cart.reduce((sum, i) => sum + i.sale_price * i.quantity, 0) - entry.discountAmount;
                const items = entry.cart.reduce((sum, i) => sum + i.quantity, 0);
                const itemsPreview = entry.cart
                  .map((i) => (i.quantity > 1 ? `${i.quantity}× ${i.name}` : i.name))
                  .join(", ");
                return (
                  <div key={entry.id} className="py-4 flex items-start gap-4">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm font-semibold font-mono">#{entry.id}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {formatTime(new Date(entry.createdAt))}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          · {items} artículo{items !== 1 ? "s" : ""}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground min-w-0">
                          <User2 className="h-3 w-3 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                          <span className="truncate" title={entry.customer?.name ?? "Cliente genérico"}>{entry.customer?.name ?? "Cliente genérico"}</span>
                        </span>
                        {entry.discountAmount > 0 && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                            Desc. {formatCurrency(entry.discountAmount)}
                          </span>
                        )}
                      </div>
                      {/* Contents preview so the cashier can identify the ticket at a glance */}
                      <p className="text-xs text-muted-foreground line-clamp-2" title={itemsPreview}>
                        {itemsPreview}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="text-base font-semibold font-mono tabular-nums whitespace-nowrap" title={formatCurrency(Math.max(0, total))}>
                        {formatCurrency(Math.max(0, total))}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => {
                            onResume(entry.id);
                            onOpenChange(false);
                          }}
                          aria-label={`Reanudar ticket #${entry.id}`}
                        >
                          <Play className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                          Reanudar
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => onRemove(entry.id)}
                          title="Descartar ticket"
                          aria-label={`Descartar ticket #${entry.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}
