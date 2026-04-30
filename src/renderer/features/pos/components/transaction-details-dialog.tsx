import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@components/ui/dialog';
import { Button } from '@components/ui/button';
import { formatCurrency } from '@lib/currency';
import { formatDateTime } from '@lib/formatters';
import { Receipt, Banknote, CreditCard, ArrowRightLeft, Printer, ShoppingBag, HandCoins, User2 } from 'lucide-react';
import { Spinner } from "@components/ui/spinner";
import { cn } from '@lib/utils';
import { toast } from 'sonner';
import { Sale } from '@shared/types/models';

interface SaleItem {
  product_name: string;
  quantity: number;
  price_at_sale: number;
}

interface TransactionDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Sale | null;
  hideCustomerName?: boolean;
}

const methodConfig: Record<string, { label: string; icon: typeof Banknote; color: string }> = {
  cash: { label: 'Efectivo', icon: Banknote, color: 'text-green-600 dark:text-green-400' },
  card: { label: 'Tarjeta', icon: CreditCard, color: 'text-blue-600 dark:text-blue-400' },
  transfer: { label: 'Transferencia', icon: ArrowRightLeft, color: 'text-purple-600 dark:text-purple-400' },
  credit: { label: 'Credito', icon: HandCoins, color: 'text-amber-600 dark:text-amber-400' },
}

const getConfig = (method: string) => methodConfig[method.toLowerCase()] || { label: method, icon: Receipt, color: 'text-muted-foreground' }

export function TransactionDetailsDialog({
  open,
  onOpenChange,
  transaction,
  hideCustomerName = false
}: TransactionDetailsDialogProps) {
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

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

  if (!open || !transaction) return null;

  const config = getConfig(transaction.payment_method);
  const MethodIcon = config.icon;
  const isCash = transaction.payment_method.toLowerCase() === 'cash';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-5 pb-3 space-y-1 border-b shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Venta #{transaction.id}</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {formatDateTime(transaction.sale_date || transaction.created_at)}
          </p>
          {transaction.status === 'credit' && (
            <span className="inline-flex items-center mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Credito — Pendiente
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Payment Summary */}
          <div className="px-5 pt-4 pb-3">
            <div className="rounded-lg border divide-y text-sm">
              {(transaction.discount_amount ?? 0) > 0 && (
                 <>
                    <div className="flex items-center justify-between px-3.5 py-2.5">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium tabular-nums">{formatCurrency(transaction.subtotal || transaction.total_amount)}</span>
                    </div>
                    <div className="flex items-center justify-between px-3.5 py-2.5 bg-red-500/5">
                      <span className="text-red-600 dark:text-red-400">Descuento</span>
                      <span className="font-medium text-red-600 dark:text-red-400 tabular-nums">-{formatCurrency(transaction.discount_amount || 0)}</span>
                    </div>
                 </>
              )}
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-muted/20">
                <span className="text-muted-foreground font-medium">Total</span>
                <span className="text-lg font-bold tabular-nums">{formatCurrency(transaction.total_amount)}</span>
              </div>
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <span className="text-muted-foreground">Método</span>
                <div className="flex items-center gap-1.5">
                  <MethodIcon className={cn("h-3.5 w-3.5", config.color)} />
                  <span className="font-medium">{config.label}</span>
                </div>
              </div>
              {isCash && (
                <>
                  <div className="flex items-center justify-between px-3.5 py-2.5">
                    <span className="text-muted-foreground">Recibido</span>
                    <span className="font-medium tabular-nums">{formatCurrency(transaction.amount_paid || 0)}</span>
                  </div>
                  {(transaction.change_given ?? 0) > 0 && (
                    <div className="flex items-center justify-between px-3.5 py-2.5 bg-green-500/5">
                      <span className="text-green-700 dark:text-green-400">Cambio</span>
                      <span className="font-bold text-green-700 dark:text-green-400 tabular-nums">
                        {formatCurrency(transaction.change_given || 0)}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
            {/* Customer info */}
            {!hideCustomerName && transaction.customer_name && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-muted/20 border mt-2">
                <User2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Cliente:</span>
                <span className="text-sm font-medium">{transaction.customer_name}</span>
              </div>
            )}
          </div>

          {/* Products */}
          <div className="px-5 pb-4 space-y-2">
            <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <ShoppingBag className="h-3 w-3" />
              Productos ({saleItems.length})
            </div>

            {isLoading ? (
              <div className="flex justify-center py-6">
                <Spinner className="size-5" />
              </div>
            ) : saleItems.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6 bg-muted/20 rounded-lg">
                No se encontraron productos
              </p>
            ) : (
              <div className="rounded-lg border divide-y">
                {saleItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between px-3.5 py-2.5 gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" title={item.product_name}>{item.product_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.quantity} × {formatCurrency(item.price_at_sale)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums shrink-0 whitespace-nowrap">
                      {formatCurrency(item.quantity * item.price_at_sale)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3.5 py-2.5 bg-muted/40">
                  <span className="text-sm font-semibold">Total</span>
                  <span className="text-sm font-bold tabular-nums">{formatCurrency(transaction.total_amount)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="p-5 pt-3 border-t flex gap-3 shrink-0">
          <Button
            variant="outline"
            onClick={handlePrint}
            disabled={isPrinting}
            className="flex-1 h-11"
          >
            {isPrinting ? (
              <>
                <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                Imprimiendo...
              </>
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
      </DialogContent>
    </Dialog>
  );
}
