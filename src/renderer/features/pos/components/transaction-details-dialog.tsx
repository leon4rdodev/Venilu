import { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@components/ui/dialog';
import { Button } from '@components/ui/button';
import { formatCurrency } from '@lib/currency';
import { formatDateTime } from '@lib/formatters';
import { Receipt, Banknote, CreditCard, ArrowRightLeft, Printer, ShoppingBag, HandCoins, User2, Trash2, ReceiptText, Undo2 } from 'lucide-react';
import { Skeleton } from "@components/ui/skeleton";
import { cn } from '@lib/utils';
import { toast } from 'sonner';
import { Sale } from '@shared/types/models';
import { usePermission } from '@renderer/features/auth/hooks/use-permission';
import { PERMISSIONS } from '@shared/permissions';
import { ConfirmDialog } from '@renderer/shared/components/confirm-dialog';
import { ReturnItemsDialog } from './return-items-dialog';

interface SaleItem {
  id?: string;
  product_name: string;
  quantity: number;
  unit_price: number;
}

interface SaleReturnItem {
  sale_item_id: string;
  product_name: string;
  quantity: number;
  amount_refunded: number;
}

interface SaleReturn {
  id: string;
  sale_id: string;
  username?: string;
  total_refunded: number;
  itbis_refunded: number;
  credit_note_ncf?: string | null;
  note?: string | null;
  /** Llega como Date por IPC, pero puede serializarse como string — sé defensivo. */
  created_at: string | Date;
  items: SaleReturnItem[];
}

/** Fecha relativa compacta en español, defensiva ante Date | string por IPC. */
function formatRelativeDate(value: string | Date | null | undefined): string {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (isNaN(date.getTime())) return 'N/A';
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 30) return `Hace ${days} días`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? 'Hace 1 mes' : `Hace ${months} meses`;
  const years = Math.floor(days / 365);
  return years === 1 ? 'Hace 1 año' : `Hace ${years} años`;
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
  credit: { label: 'Crédito', icon: HandCoins, color: 'text-amber-600 dark:text-amber-400' },
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
  const [saleReturns, setSaleReturns] = useState<SaleReturn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  const [confirmVoidOpen, setConfirmVoidOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const canVoid = usePermission(PERMISSIONS.SALES_VOID);
  const canReturn = usePermission(PERMISSIONS.SALES_RETURN);

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

  const fetchSaleReturns = useCallback(async () => {
    if (!transaction) return;

    try {
      if (!window.ipcRenderer) {
        throw new Error('IPC Renderer not available');
      }

      const result = await window.ipcRenderer.invoke('get-sale-returns', { saleId: transaction.id }) as {
        success: boolean;
        data?: SaleReturn[];
        message?: string;
      };

      setSaleReturns(result.success ? (result.data || []) : []);
    } catch (err) {
      console.error('Error fetching sale returns:', err);
      setSaleReturns([]);
    }
  }, [transaction]);

  useEffect(() => {
    if (open && transaction) {
      fetchSaleItems();
      fetchSaleReturns();
    }
  }, [open, transaction, fetchSaleItems, fetchSaleReturns]);

  /** Unidades ya devueltas por sale_item_id, sumando sobre todas las devoluciones. */
  const alreadyReturned = useMemo(() => {
    const map = new Map<string, number>();
    for (const ret of saleReturns) {
      for (const item of ret.items || []) {
        map.set(item.sale_item_id, (map.get(item.sale_item_id) ?? 0) + item.quantity);
      }
    }
    return map;
  }, [saleReturns]);

  /** Quedan unidades por devolver: suma vendida > suma devuelta. */
  const hasReturnableUnits = useMemo(() => {
    const soldUnits = saleItems.reduce((sum, item) => sum + item.quantity, 0);
    let returnedUnits = 0;
    alreadyReturned.forEach((qty) => { returnedUnits += qty; });
    return soldUnits > returnedUnits;
  }, [saleItems, alreadyReturned]);

  /** Venta fiada con deuda pendiente: no se devuelve, se anula (regla del servidor). */
  const hasOutstandingCredit = useMemo(() => {
    if (!transaction || transaction.payment_method !== 'credit') return false;
    return Number(transaction.total_amount) - Number(transaction.amount_paid ?? 0) > 0.009;
  }, [transaction]);

  const handleReturnSuccess = useCallback(() => {
    // Recarga items y devoluciones del diálogo (sin cerrarlo)
    fetchSaleItems();
    fetchSaleReturns();
    // La devolución repone stock — notifica al inventario y al padre
    window.dispatchEvent(new CustomEvent('inventory-updated'));
    onVoidSuccess?.();
  }, [fetchSaleItems, fetchSaleReturns, onVoidSuccess]);

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
                <DialogTitle className="text-base font-semibold tracking-tight leading-normal tabular-nums">
                  Venta #{transaction.id}
                </DialogTitle>
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
              <DialogDescription className="text-sm text-muted-foreground mt-0.5 tabular-nums">
                {formatDateTime(transaction.sale_date || transaction.created_at)}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
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
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-muted/40 border border-border mt-2 min-w-0">
                <User2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.75} aria-hidden="true" />
                <span className="text-sm text-muted-foreground shrink-0">Cliente:</span>
                <span className="text-sm font-medium truncate" title={transaction.customer_name}>
                  {transaction.customer_name}
                </span>
              </div>
            )}
            {isVoided && (
              <div
                role="status"
                className="mt-3 px-3.5 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium flex items-center gap-2"
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                Esta venta fue anulada y los productos devueltos al inventario.
              </div>
            )}
          </div>

          {/* Comprobante Fiscal */}
          {transaction.ncf && (
            <div className="px-5 pb-3 space-y-2">
              <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <ReceiptText className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                Comprobante Fiscal
              </h3>
              <div className="bg-card border border-border rounded-lg divide-y divide-border text-sm">
                <div className="flex items-center justify-between px-3.5 py-2.5">
                  <span className="text-muted-foreground">Tipo</span>
                  <span className="font-medium text-right">
                    {transaction.ncf_type === 'B01' ? 'Factura de Crédito Fiscal (B01)' : 'Factura de Consumo (B02)'}
                  </span>
                </div>
                <div className="flex items-center justify-between px-3.5 py-2.5">
                  <span className="text-muted-foreground">NCF</span>
                  <span className="font-medium font-mono tabular-nums text-right">{transaction.ncf}</span>
                </div>
                {transaction.fiscal_customer_rnc && (
                  <div className="flex items-center justify-between px-3.5 py-2.5">
                    <span className="text-muted-foreground">RNC/Cédula</span>
                    <span className="font-medium font-mono tabular-nums text-right">{transaction.fiscal_customer_rnc}</span>
                  </div>
                )}
                {transaction.fiscal_customer_name && (
                  <div className="flex items-center justify-between px-3.5 py-2.5 gap-3">
                    <span className="text-muted-foreground shrink-0">Razón Social</span>
                    <span className="font-medium text-right truncate" title={transaction.fiscal_customer_name}>
                      {transaction.fiscal_customer_name}
                    </span>
                  </div>
                )}
                {transaction.itbis_amount != null && (
                  <div className="flex items-center justify-between px-3.5 py-2.5">
                    <span className="text-muted-foreground">ITBIS incluido</span>
                    <span className="font-medium font-mono tabular-nums text-right">{formatCurrency(transaction.itbis_amount)}</span>
                  </div>
                )}
                {isVoided && transaction.credit_note_ncf && (
                  <div className="flex items-center justify-between px-3.5 py-2.5 gap-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive shrink-0">
                      Nota de Crédito (B04)
                    </span>
                    <span className="font-medium font-mono tabular-nums text-right">{transaction.credit_note_ncf}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Products */}
          <div className="px-5 pb-4 space-y-2">
            <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <ShoppingBag className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
              Productos{!isLoading && <span className="tabular-nums"> ({saleItems.length})</span>}
            </h3>

            {isLoading ? (
              <div
                role="status"
                aria-live="polite"
                aria-label="Cargando productos de la venta"
                className="bg-card border border-border rounded-lg divide-y divide-border"
              >
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
                      <p className="text-xs text-muted-foreground truncate tabular-nums">
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

          {/* Devoluciones */}
          {saleReturns.length > 0 && (
            <div className="px-5 pb-4 space-y-2">
              <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Undo2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                Devoluciones <span className="tabular-nums">({saleReturns.length})</span>
              </h3>
              <div className="bg-card border border-border rounded-lg divide-y divide-border">
                {saleReturns.map((ret) => {
                  const units = (ret.items || []).reduce((sum, item) => sum + item.quantity, 0);
                  return (
                    <div key={ret.id} className="flex items-center justify-between px-3.5 py-2.5 gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium" title={formatDateTime(ret.created_at)}>
                            {formatRelativeDate(ret.created_at)}
                          </p>
                          {ret.credit_note_ncf && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground font-mono tabular-nums">
                              NC {ret.credit_note_ncf}
                            </span>
                          )}
                        </div>
                        <p
                          className="text-xs text-muted-foreground truncate tabular-nums"
                          title={`Devolución #${ret.id}${ret.username ? ` · por ${ret.username}` : ''}`}
                        >
                          #{ret.id} · {units} artículo{units === 1 ? '' : 's'}{ret.username ? ` · por ${ret.username}` : ''}
                        </p>
                      </div>
                      <span className="text-sm font-medium font-mono tabular-nums text-red-600 dark:text-red-400 text-right shrink-0 whitespace-nowrap">
                        -{formatCurrency(ret.total_refunded)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-5 pt-4 border-t border-border flex flex-col gap-3 shrink-0">
          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              onClick={handlePrint}
              disabled={isPrinting || isVoided}
              aria-busy={isPrinting}
              title={isVoided ? 'No se puede imprimir una venta anulada' : undefined}
              className="flex-1 h-10"
            >
              {isPrinting ? (
                <>Imprimiendo...</>
              ) : (
                <>
                  <Printer className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  Imprimir
                </>
              )}
            </Button>
            <Button
              onClick={() => onOpenChange(false)}
              className="flex-1 h-10"
            >
              Cerrar
            </Button>
          </div>

          {!isVoided && (canVoid || (canReturn && hasReturnableUnits && !hasOutstandingCredit)) && (
            <div className="flex gap-3 w-full pt-3 border-t border-border">
              {canReturn && hasReturnableUnits && !hasOutstandingCredit && (
                <Button
                  variant="outline"
                  onClick={() => setReturnDialogOpen(true)}
                  disabled={isLoading}
                  className="flex-1 h-10 gap-2 text-sm font-medium"
                >
                  <Undo2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  Devolver artículos
                </Button>
              )}
              {canVoid && (
              <Button
                variant="ghost"
                onClick={() => setConfirmVoidOpen(true)}
                disabled={isVoiding}
                aria-busy={isVoiding}
                className="flex-1 h-10 text-destructive hover:text-destructive hover:bg-destructive/10 focus-visible:ring-destructive/40 gap-2 text-sm font-medium"
              >
                {isVoiding ? (
                  <>Anulando...</>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                    Anular esta venta
                  </>
                )}
              </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>

      <ReturnItemsDialog
        open={returnDialogOpen}
        onOpenChange={setReturnDialogOpen}
        transaction={transaction}
        saleItems={saleItems}
        alreadyReturned={alreadyReturned}
        onSuccess={handleReturnSuccess}
      />

      <ConfirmDialog
        open={confirmVoidOpen}
        onOpenChange={setConfirmVoidOpen}
        title="Anular venta"
        description={`Se anulará la venta #${transaction?.id ?? ''}, se restaurará el stock de sus productos y la acción no se puede deshacer.`}
        confirmLabel="Anular venta"
        loadingLabel="Anulando..."
        variant="destructive"
        loading={isVoiding}
        onConfirm={async () => {
          await handleVoid();
          setConfirmVoidOpen(false);
        }}
      />
    </Dialog>
  );
}
