import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@components/ui/dialog';
import { Button } from '@components/ui/button';
import { formatCurrency } from '@lib/currency';
import { formatDateTime } from '@lib/formatters';
import { Receipt, Banknote, CreditCard, ArrowRightLeft, Printer, ShoppingBag, HandCoins, User2, Trash2 } from 'lucide-react';
import { Skeleton } from "@components/ui/skeleton";
import { cn } from '@lib/utils';
import { toast } from 'sonner';
import { Sale } from '@shared/types/models';
import { usePermission } from '@renderer/features/auth/hooks/use-permission';
import { PERMISSIONS } from '@shared/permissions';

interface SaleItem {
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface TransactionDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Sale | null;
  hideCustomerName?: boolean;
  onVoidSuccess?: () => void;
}

const methodConfig: Record<string, { label: string; icon: typeof Banknote; color: string }> = {
  cash: { label: 'Efectivo', icon: Banknote, color: 'text-emerald-600 dark:text-emerald-400' },
  card: { label: 'Tarjeta', icon: CreditCard, color: 'text-muted-foreground' },
  transfer: { label: 'Transferencia', icon: ArrowRightLeft, color: 'text-muted-foreground' },
  credit: { label: 'Credito', icon: HandCoins, color: 'text-amber-600 dark:text-amber-400' },
}

const getConfig = (method: string) => methodConfig[method.toLowerCase()] || { label: method, icon: Receipt, color: 'text-muted-foreground' }

export function TransactionDetailsDialog({
  open,
  onOpenChange,
  transaction,
  hideCustomerName = false,
  onVoidSuccess
}: TransactionDetailsDialogProps) {
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const canVoid = usePermission(PERMISSIONS.SALES_VOID);

  const fetchSaleItems = useCallback(async () => {
    if (!transaction) return;

    setIsLoading(true);
    try {
      if (!window.ipcRenderer) {
        throw new Error('IPC Renderer not available');
      }

      const result = await window.ipcRenderer.invoke('get-sale-items', transaction.id) as {
        success: boolean;
        data?: SaleItem[];
        message?: string;
      };

      if (result.success) {
        setSaleItems(result.data || []);
      } else {
        setSaleItems([]);
        toast.error('Error al cargar productos', { description: result.message });
      }
    } catch (err) {
      console.error('Error fetching sale items:', err);
      setSaleItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [transaction]);

  useEffect(() => {
    if (open && transaction) {
      fetchSaleItems();
    }
  }, [open, transaction, fetchSaleItems]);

  const handlePrint = async () => {
    if (!transaction || !window.ipcRenderer) {
      toast.error('Sistema de impresión no disponible');
      return;
    }

    setIsPrinting(true);
    try {
      const result = await window.ipcRenderer.invoke('print-receipt', { saleId: transaction.id }) as {
        success: boolean;
        message?: string;
      };

      if (result.success) {
        toast.success('Ticket impreso', { description: `Venta #${transaction.id}` });
      } else {
        toast.error('Error al imprimir', { description: result.message || 'No se pudo imprimir' });
      }
    } catch {
      toast.error('Error al imprimir');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleVoid = async () => {
    if (!transaction || !window.ipcRenderer) return;

    const confirmed = window.confirm('¿Estás seguro de que deseas anular esta venta? Esta acción restaurará el stock y no se puede deshacer.');
    if (!confirmed) return;

    setIsVoiding(true);
    try {
      const result = await window.ipcRenderer.invoke('sales:void', { saleId: transaction.id }) as {
        success: boolean;
        message?: string;
      };

      if (result.success) {
        toast.success('Venta anulada correctamente');
        onVoidSuccess?.();
        onOpenChange(false);
      } else {
        toast.error(result.message || 'Error al anular venta');
      }
    } catch (_error) {
      toast.error('Error de conexión');
    } finally {
      setIsVoiding(false);
    }
  };

  if (!open || !transaction) return null;

  const config = getConfig(transaction.payment_method);
  const MethodIcon = config.icon;
  const isCash = transaction.payment_method.toLowerCase() === 'cash';
  const isVoided = transaction.status === 'voided';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Receipt className="h-4 w-4 text-foreground" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold tracking-tight">Venta #{transaction.id}</h2>
                {isVoided && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400">
                    Anulada
                  </span>
                )}
                {transaction.status === 'credit' && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    Crédito — Pendiente
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {formatDateTime(transaction.sale_date || transaction.created_at)}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className={cn("flex-1 overflow-y-auto", isVoided && "opacity-60")}>
          {/* Payment Summary */}
          <div className="px-5 pt-4 pb-3">
            <div className="bg-card border border-border rounded-lg divide-y divide-border text-sm">
              {(transaction.discount_amount ?? 0) > 0 && (
                 <>
                    <div className="flex items-center justify-between px-3.5 py-2.5">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium font-mono tabular-nums text-right">{formatCurrency(transaction.subtotal || transaction.total_amount)}</span>
                    </div>
                    <div className="flex items-center justify-between px-3.5 py-2.5">
                      <span className="text-red-600 dark:text-red-400">Descuento</span>
                      <span className="font-medium text-red-600 dark:text-red-400 font-mono tabular-nums text-right">-{formatCurrency(transaction.discount_amount || 0)}</span>
                    </div>
                 </>
              )}
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-muted/40">
                <span className="text-sm font-semibold">Total</span>
                <span className={cn("text-base font-semibold font-mono tabular-nums text-right", isVoided && "line-through text-muted-foreground")}>{formatCurrency(transaction.total_amount)}</span>
              </div>
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <span className="text-muted-foreground">Método</span>
                <div className="flex items-center gap-1.5">
                  <MethodIcon className={cn("h-3.5 w-3.5", config.color)} strokeWidth={1.75} />
                  <span className="font-medium">{config.label}</span>
                </div>
              </div>
              {isCash && (
                <>
                  <div className="flex items-center justify-between px-3.5 py-2.5">
                    <span className="text-muted-foreground">Recibido</span>
                    <span className="font-medium font-mono tabular-nums text-right">{formatCurrency(transaction.amount_paid || 0)}</span>
                  </div>
                  {(transaction.change_given ?? 0) > 0 && (
                    <div className="flex items-center justify-between px-3.5 py-2.5">
                      <span className="text-emerald-600 dark:text-emerald-400">Cambio</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400 font-mono tabular-nums text-right">
                        {formatCurrency(transaction.change_given || 0)}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
            {/* Customer info */}
            {!hideCustomerName && transaction.customer_name && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-muted/40 border border-border mt-2">
                <User2 className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
                <span className="text-sm text-muted-foreground">Cliente:</span>
                <span className="text-sm font-medium">{transaction.customer_name}</span>
              </div>
            )}
            {isVoided && (
              <div className="mt-3 px-3.5 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium flex items-center gap-2">
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                Esta venta fue anulada y los productos devueltos al inventario.
              </div>
            )}
          </div>

          {/* Products */}
          <div className="px-5 pb-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <ShoppingBag className="h-3.5 w-3.5" strokeWidth={1.75} />
              Productos ({saleItems.length})
            </div>

            {isLoading ? (
              <div className="bg-card border border-border rounded-lg divide-y divide-border">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between px-3.5 py-2.5 gap-3">
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
                <div className="flex items-center justify-between px-3.5 py-2.5 bg-muted/40">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            ) : saleItems.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6 bg-muted/40 border border-border rounded-lg">
                No se encontraron productos
              </p>
            ) : (
              <div className="bg-card border border-border rounded-lg divide-y divide-border">
                {saleItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between px-3.5 py-2.5 gap-3">
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-medium truncate", isVoided && "line-through text-muted-foreground")} title={item.product_name}>{item.product_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.quantity} × {formatCurrency(item.unit_price)}
                      </p>
                    </div>
                    <span className={cn("text-sm font-medium font-mono tabular-nums text-right shrink-0 whitespace-nowrap", isVoided && "line-through text-muted-foreground")}>
                      {formatCurrency(item.quantity * item.unit_price)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3.5 py-2.5 bg-muted/40">
                  <span className="text-sm font-semibold">Total</span>
                  <span className={cn("text-sm font-semibold font-mono tabular-nums text-right", isVoided && "line-through text-muted-foreground")}>{formatCurrency(transaction.total_amount)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-5 pt-3 border-t border-border flex flex-col gap-3 shrink-0">
          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              onClick={handlePrint}
              disabled={isPrinting || isVoided}
              className="flex-1 h-11"
            >
              {isPrinting ? (
                <>Imprimiendo...</>
              ) : (
                <>
                  <Printer className="h-4 w-4" />
                  Imprimir
                </>
              )}
            </Button>
            <Button
              onClick={() => onOpenChange(false)}
              className="flex-1 h-11"
            >
              Cerrar
            </Button>
          </div>

          {!isVoided && canVoid && (
            <Button
              variant="ghost"
              onClick={handleVoid}
              disabled={isVoiding}
              className="w-full h-10 text-destructive hover:text-destructive hover:bg-destructive/10 gap-2 text-sm font-medium"
            >
              {isVoiding ? (
                <>Anulando...</>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                  Anular esta venta
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
