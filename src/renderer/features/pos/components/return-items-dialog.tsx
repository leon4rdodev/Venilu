import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@components/ui/dialog';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { formatCurrency } from '@lib/currency';
import { Undo2, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Sale } from '@shared/types/models';

interface ReturnableSaleItem {
  id?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface ReturnItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Sale | null;
  saleItems: ReturnableSaleItem[];
  alreadyReturned: Map<string, number> | Record<string, number>;
  onSuccess: () => void;
}

function getReturned(source: Map<string, number> | Record<string, number>, id: string): number {
  if (source instanceof Map) return source.get(id) ?? 0;
  return source[id] ?? 0;
}

export function ReturnItemsDialog({
  open,
  onOpenChange,
  transaction,
  saleItems,
  alreadyReturned,
  onSuccess,
}: ReturnItemsDialogProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset selection when the dialog opens
  useEffect(() => {
    if (open) {
      setQuantities({});
      setNote('');
    }
  }, [open]);

  // Factor de descuento de la venta: el reembolso es proporcional al total pagado
  const discountFactor = useMemo(() => {
    if (!transaction) return 1;
    const subtotal = transaction.subtotal ?? 0;
    return subtotal > 0 ? transaction.total_amount / subtotal : 1;
  }, [transaction]);

  const totalUnits = useMemo(
    () => Object.values(quantities).reduce((sum, q) => sum + q, 0),
    [quantities]
  );

  const totalToRefund = useMemo(() => {
    let total = 0;
    for (const item of saleItems) {
      if (!item.id) continue;
      const qty = quantities[item.id] ?? 0;
      if (qty > 0) total += item.unit_price * qty * discountFactor;
    }
    return total;
  }, [saleItems, quantities, discountFactor]);

  if (!open || !transaction) return null;

  const adjustQuantity = (itemId: string, delta: number, max: number) => {
    setQuantities((prev) => {
      const next = Math.min(max, Math.max(0, (prev[itemId] ?? 0) + delta));
      return { ...prev, [itemId]: next };
    });
  };

  const handleSubmit = async () => {
    if (!transaction || totalUnits <= 0) return;

    if (!window.ipcRenderer) {
      toast.error('Sistema no disponible');
      return;
    }

    const items = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([sale_item_id, quantity]) => ({ sale_item_id, quantity }));

    setIsSubmitting(true);
    try {
      const result = await window.ipcRenderer.invoke('sales:return', {
        saleId: transaction.id,
        items,
        note: note.trim() || undefined,
      }) as {
        success: boolean;
        returnId?: string;
        totalRefunded?: number;
        creditNoteNcf?: string;
        message?: string;
      };

      if (result.success) {
        const refunded = formatCurrency(result.totalRefunded ?? totalToRefund);
        toast.success(
          `Devolución #${result.returnId ?? ''} procesada — ${refunded} reembolsados` +
            (result.creditNoteNcf ? ` · NC ${result.creditNoteNcf}` : '')
        );
        onSuccess();
        onOpenChange(false);
      } else {
        toast.error(result.message || 'Error al procesar la devolución');
      }
    } catch (error) {
      console.error('Error processing return:', error);
      toast.error('Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Undo2 className="h-4 w-4 text-foreground" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold tracking-tight leading-normal">
                Devolver Artículos
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-0.5 tabular-nums">
                Venta #{transaction.id}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-4">
            {/* Items */}
            <div className="bg-card border border-border rounded-lg divide-y divide-border">
              {saleItems.map((item, index) => {
                const itemId = item.id;
                const returned = itemId ? getReturned(alreadyReturned, itemId) : 0;
                const remaining = Math.max(0, item.quantity - returned);
                const selected = itemId ? (quantities[itemId] ?? 0) : 0;
                const disabled = !itemId || remaining <= 0;

                return (
                  <div
                    key={itemId ?? index}
                    className="flex items-center justify-between px-3.5 py-2.5 gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-medium truncate"
                        title={item.product_name}
                      >
                        {item.product_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate tabular-nums">
                        {formatCurrency(item.unit_price)} · Vendidos: {item.quantity} · Ya devueltos: {returned}
                      </p>
                    </div>
                    {disabled ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground shrink-0">
                        Devuelto
                      </span>
                    ) : (
                      <div
                        className="flex items-center gap-1 shrink-0"
                        role="group"
                        aria-label={`Unidades a devolver de ${item.product_name}`}
                      >
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => adjustQuantity(itemId!, -1, remaining)}
                          disabled={isSubmitting || selected <= 0}
                          aria-label={`Quitar una unidad de ${item.product_name}`}
                        >
                          <Minus className="h-3 w-3" strokeWidth={1.75} />
                        </Button>
                        <span
                          className="w-8 text-center text-sm font-medium tabular-nums"
                          aria-live="polite"
                          aria-label={`${selected} de ${remaining} disponibles`}
                        >
                          {selected}
                        </span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => adjustQuantity(itemId!, 1, remaining)}
                          disabled={isSubmitting || selected >= remaining}
                          aria-label={`Agregar una unidad de ${item.product_name}`}
                        >
                          <Plus className="h-3 w-3" strokeWidth={1.75} />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <Label
                htmlFor="return-note"
                className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
              >
                Motivo (opcional)
              </Label>
              <Input
                id="return-note"
                placeholder="Ej: Producto defectuoso, cliente cambió de opinión..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={300}
                disabled={isSubmitting}
                className="bg-background"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 pt-4 border-t border-border space-y-3 shrink-0">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total a reembolsar</span>
            <span className="text-base font-semibold font-mono tabular-nums text-right" aria-live="polite">
              {formatCurrency(totalToRefund)}
            </span>
          </div>
          <div className="text-xs text-muted-foreground leading-relaxed">
            <p>El reembolso sale en efectivo de tu caja.</p>
            {transaction.ncf && <p>Se emitirá una Nota de Crédito (B04).</p>}
          </div>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || totalUnits <= 0}
            aria-busy={isSubmitting}
            className="w-full h-10 gap-2"
          >
            {isSubmitting ? (
              <>Procesando...</>
            ) : (
              <>
                <Undo2 className="h-4 w-4" strokeWidth={1.75} />
                Procesar Devolución
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
