
import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
} from '@components/ui/dialog';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { formatCurrency, getCurrencySymbol } from '@lib/currency';
import { useShift } from '../hooks/use-shift';
import { toast } from 'sonner';
import {
  Wallet,
  Banknote,
  CreditCard,
  TrendingUp,
  CheckCircle2,
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  LockKeyhole,
  HandCoins,
} from 'lucide-react';
import { cn } from '@lib/utils';

interface CloseShiftDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CloseShiftDialog({ isOpen, onClose }: CloseShiftDialogProps) {
  const [finalCash, setFinalCash] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { activeShift, shiftSales, shiftDebtPayments, closeShift } = useShift();

  const { initialCash, cashSalesTotal, expectedCash, totalSales, otherSalesTotal, totalTransactions, cashDebtTotal, transferDebtTotal, totalDebtPayments } = useMemo(() => {
    if (!activeShift) return { initialCash: 0, cashSalesTotal: 0, expectedCash: 0, totalSales: 0, otherSalesTotal: 0, totalTransactions: 0, cashDebtTotal: 0, transferDebtTotal: 0, totalDebtPayments: 0 };

    const cashSales = shiftSales.filter(s => s.payment_method === 'cash');
    const otherSales = shiftSales.filter(s => s.payment_method !== 'cash' && s.payment_method !== 'credit');

    const cashSalesTotal = cashSales.reduce((sum, sale) => sum + sale.total_amount, 0);
    const otherSalesTotal = otherSales.reduce((sum, sale) => sum + sale.total_amount, 0);

    // Debt payments received during this shift
    const cashDebtPayments = shiftDebtPayments.filter(p => p.payment_method === 'cash');
    const transferDebtPayments = shiftDebtPayments.filter(p => p.payment_method === 'transfer');
    const cashDebtTotal = cashDebtPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const transferDebtTotal = transferDebtPayments.reduce((sum, p) => sum + Number(p.amount), 0);

    return {
      initialCash: activeShift.initial_cash,
      cashSalesTotal,
      otherSalesTotal,
      totalSales: cashSalesTotal + otherSalesTotal,
      // Cash abonos count as cash received in the drawer
      expectedCash: activeShift.initial_cash + cashSalesTotal + cashDebtTotal,
      totalTransactions: shiftSales.length,
      cashDebtTotal,
      transferDebtTotal,
      totalDebtPayments: shiftDebtPayments.length,
    };
  }, [activeShift, shiftSales, shiftDebtPayments]);

  const difference = useMemo(() => {
    const final = parseFloat(finalCash);
    if (isNaN(final) || !activeShift) return null;
    return final - expectedCash;
  }, [finalCash, expectedCash, activeShift]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setFinalCash(value);
    }
  };

  const handleCloseShift = async () => {
    const cashAmount = parseFloat(finalCash);
    if (isNaN(cashAmount) || cashAmount < 0) {
      toast.error('Monto inválido', {
        description: 'Por favor, introduce un monto de efectivo final válido.',
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await closeShift(cashAmount);
      setIsLoading(false);

      if (result.success) {
        toast.success('Turno cerrado exitosamente', {
          description: 'El arqueo de caja ha sido completado.',
        });
        setFinalCash('');
        onClose();
      } else {
        toast.error('Error al cerrar turno', {
          description: result.message || 'Ocurrió un error inesperado.',
        });
      }
    } catch (error) {
      console.error('Error in handleCloseShift:', error);
      setIsLoading(false);
      toast.error('Error al cerrar turno', {
        description: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  };

  const shiftDuration = useMemo(() => {
    if (!activeShift) return '';
    const start = new Date(activeShift.start_time);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }, [activeShift]);

  const isValidAmount = finalCash !== '' && !isNaN(parseFloat(finalCash)) && parseFloat(finalCash) >= 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 pb-3 space-y-1 shrink-0 border-b">
          <h2 className="text-xl font-semibold tracking-tight">Cerrar Caja</h2>
          <p className="text-sm text-muted-foreground">
            Realiza el arqueo y cierra el turno actual
          </p>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto min-h-0">

        {/* Shift Duration Badge */}
        <div className="px-5 pt-4 pb-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/60 text-xs font-medium text-muted-foreground">
            <Clock className="h-3 w-3" />
            Turno activo: {shiftDuration}
          </div>
        </div>

        {/* Sales Summary Section */}
        <div className="px-5 pb-3">
          <div className="rounded-lg border bg-muted/30 divide-y">
            {/* Revenue Overview */}
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                <TrendingUp className="h-3 w-3" />
                Resumen de Ventas
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2.5 rounded-md bg-background/50 border min-w-0">
                  <p className="text-2xl font-bold tabular-nums">{totalTransactions}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Transacciones</p>
                </div>
                <div className="text-center p-2.5 rounded-md bg-background/50 border min-w-0">
                  <p className="text-sm font-bold tabular-nums truncate" title={formatCurrency(totalSales)}>{formatCurrency(totalSales)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Ventas Totales</p>
                </div>
                <div className="text-center p-2.5 rounded-md bg-background/50 border min-w-0">
                  <p className="text-sm font-bold tabular-nums truncate" title={formatCurrency(totalTransactions > 0 ? totalSales / totalTransactions : 0)}>{formatCurrency(totalTransactions > 0 ? totalSales / totalTransactions : 0)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Ticket Promedio</p>
                </div>
              </div>
            </div>

            {/* Payment Breakdown */}
            <div className="p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm shrink-0">
                  <Banknote className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span>Efectivo</span>
                </div>
                <span className="text-sm font-semibold tabular-nums truncate" title={formatCurrency(cashSalesTotal)}>{formatCurrency(cashSalesTotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm shrink-0">
                  <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span>Tarjeta / Transferencia</span>
                </div>
                <span className="text-sm font-semibold tabular-nums truncate" title={formatCurrency(otherSalesTotal)}>{formatCurrency(otherSalesTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Abonos Section */}
        {shiftDebtPayments.length > 0 && (
          <div className="px-5 pb-3">
            <div className="rounded-lg border bg-muted/30 divide-y">
              <div className="p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  <HandCoins className="h-3 w-3" />
                  Abonos a Deudas ({totalDebtPayments})
                </div>
                {cashDebtTotal > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm shrink-0">
                      <Banknote className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span>Efectivo</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums text-green-700 dark:text-green-400">+{formatCurrency(cashDebtTotal)}</span>
                  </div>
                )}
                {transferDebtTotal > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm shrink-0">
                      <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span>Transferencia</span>
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{formatCurrency(transferDebtTotal)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Cash Reconciliation */}
        <div className="px-5 pb-3 space-y-2">
          <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            <Wallet className="h-3 w-3" />
            Arqueo de Caja
          </div>

          <div className="rounded-lg border divide-y text-sm">
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
              <span className="text-sm text-muted-foreground shrink-0">Fondo inicial</span>
              <span className="text-sm font-medium tabular-nums truncate">{formatCurrency(initialCash)}</span>
            </div>
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
              <span className="text-sm text-muted-foreground shrink-0">+ Ventas en efectivo</span>
              <span className="text-sm font-medium tabular-nums truncate text-green-700 dark:text-green-400">+{formatCurrency(cashSalesTotal)}</span>
            </div>
            {cashDebtTotal > 0 && (
              <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                <span className="text-sm text-muted-foreground shrink-0">+ Abonos en efectivo</span>
                <span className="text-sm font-medium tabular-nums truncate text-green-700 dark:text-green-400">+{formatCurrency(cashDebtTotal)}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-muted/40">
              <span className="text-sm font-semibold shrink-0">Efectivo esperado</span>
              <span className="text-sm font-bold tabular-nums truncate">{formatCurrency(expectedCash)}</span>
            </div>
          </div>
        </div>

        {/* Cash Count Input */}
        <div className="px-5 pb-3 space-y-1.5">
          <Label htmlFor="final-cash" className="text-sm font-medium">
            Efectivo contado en caja
          </Label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground pointer-events-none">
              {getCurrencySymbol()}
            </div>
            <Input
              id="final-cash"
              type="text"
              inputMode="decimal"
              value={finalCash}
              onChange={handleAmountChange}
              placeholder="0.00"
              className="h-12 text-lg! text-right font-bold pl-20 pr-5"
              style={{ fontSize: '1.25rem' }}
              autoFocus
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Difference Indicator */}
        {difference !== null && (
          <div className="px-5 pb-3">
            <div
              className={cn(
                "flex items-center justify-between p-3.5 rounded-lg border",
                difference === 0
                  ? "bg-green-500/10 border-green-500/20"
                  : difference < 0
                    ? "bg-red-500/10 border-red-500/20"
                    : "bg-amber-500/10 border-amber-500/20"
              )}
            >
              <div className="flex items-center gap-2">
                {difference === 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                ) : difference < 0 ? (
                  <ArrowDownCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                ) : (
                  <ArrowUpCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                )}
                <div>
                  <p className={cn(
                    "text-sm font-semibold",
                    difference === 0 ? "text-green-700 dark:text-green-400"
                      : difference < 0 ? "text-red-700 dark:text-red-400"
                        : "text-amber-700 dark:text-amber-400"
                  )}>
                    {difference === 0 ? "Cuadre perfecto" : difference < 0 ? "Faltante de caja" : "Sobrante de caja"}
                  </p>
                  {difference !== 0 && (
                    <p className={cn(
                      "text-[11px]",
                      difference < 0 ? "text-red-600/70 dark:text-red-400/70" : "text-amber-600/70 dark:text-amber-400/70"
                    )}>
                      {difference < 0 ? "Se esperaba más efectivo del contado" : "Hay más efectivo del esperado"}
                    </p>
                  )}
                </div>
              </div>
              <span className={cn(
                "text-sm font-bold tabular-nums shrink-0",
                difference === 0 ? "text-green-700 dark:text-green-400"
                  : difference < 0 ? "text-red-700 dark:text-red-400"
                    : "text-amber-700 dark:text-amber-400"
              )}>
                {difference > 0 ? '+' : ''}{formatCurrency(difference)}
              </span>
            </div>
          </div>
        )}

        </div>{/* end scrollable */}

        {/* Actions */}
        <div className="p-5 pt-3 border-t flex gap-3 shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 h-11"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleCloseShift}
            disabled={isLoading || !isValidAmount}
            className="flex-1 h-11"
            variant={difference !== null && difference < 0 ? "destructive" : "default"}
          >
            {isLoading ? (
              <>
                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Cerrando...
              </>
            ) : (
              <><LockKeyhole className="h-4 w-4" />Cerrar Turno</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
