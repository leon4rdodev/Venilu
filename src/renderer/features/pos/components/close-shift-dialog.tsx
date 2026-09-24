
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@components/ui/dialog';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { formatCurrency, getCurrencySymbol } from '@lib/currency';
import { useShift } from '../hooks/use-shift';
import { computeShiftCash } from '@shared/cash-reconciliation';
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
  Eye,
  Calculator,
  ChevronDown,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { cn } from '@lib/utils';
import { ViewExpensesDialog } from './view-expenses-dialog';
import { getDenominations, denominationSubtotal, computeCashCountTotal } from './cash-denominations';

interface CloseShiftDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CloseShiftDialog({ isOpen, onClose }: CloseShiftDialogProps) {
  const [finalCash, setFinalCash] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showExpensesList, setShowExpensesList] = useState(false);
  const [showCounter, setShowCounter] = useState(false);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const { activeShift, shiftSales, shiftDebtPayments, shiftExpenses, shiftCapitals, shiftReturns, closeShift } = useShift();

  // Focus the cash input when the dialog opens; reset the denomination counter
  useEffect(() => {
    if (isOpen) {
      setShowCounter(false);
      setCounts({});
      const id = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [isOpen]);

  // Denominations for the active currency (re-read each time the dialog opens)
  const denominations = useMemo(
    () => getDenominations(localStorage.getItem('venilu_currency') ?? 'DOP'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOpen]
  );

  const countTotal = useMemo(() => {
    const numeric: Record<string, number> = {};
    for (const [denomination, qty] of Object.entries(counts)) {
      numeric[denomination] = parseInt(qty, 10) || 0;
    }
    return computeCashCountTotal(numeric);
  }, [counts]);

  const hasCounted = useMemo(() => Object.values(counts).some(v => v !== ''), [counts]);

  const handleCountChange = (denomination: number, value: string) => {
    if (value === '' || /^\d{1,4}$/.test(value)) {
      setCounts(prev => ({ ...prev, [String(denomination)]: value }));
    }
  };

  const handleClearCounts = () => setCounts({});

  const handleUseCountTotal = () => {
    setFinalCash(countTotal.toFixed(2));
    setShowCounter(false);
  };

  const {
    initialCash, cashSalesTotal, expectedCash, totalSales, otherSalesTotal, totalTransactions,
    cashDebtTotal, cashRefunds, transferDebtTotal, totalDebtPayments, totalExpenses, totalCapital, totalReturns,
  } = useMemo(() => {
    if (!activeShift) {
      return {
        initialCash: 0, cashSalesTotal: 0, expectedCash: 0, totalSales: 0, otherSalesTotal: 0, totalTransactions: 0,
        cashDebtTotal: 0, cashRefunds: 0, transferDebtTotal: 0, totalDebtPayments: 0, totalExpenses: 0, totalCapital: 0, totalReturns: 0,
      };
    }

    const activeSales = shiftSales.filter(s => s.status !== 'voided');
    const otherSales = activeSales.filter(s => s.payment_method !== 'cash' && s.payment_method !== 'credit');
    const otherSalesTotal = otherSales.reduce((sum, sale) => sum + Number(sale.total_amount), 0);

    // Same formula as the backend arqueo (@shared/cash-reconciliation):
    // refunds of collected credit sales and partial returns LEAVE the drawer,
    // capital injections (aportes) ADD to it.
    const cash = computeShiftCash({
      initialCash: activeShift.initial_cash,
      sales: shiftSales,
      debtPayments: shiftDebtPayments,
      expenses: shiftExpenses,
      capital: shiftCapitals,
      returns: shiftReturns,
    });

    return {
      initialCash: cash.initialCash,
      cashSalesTotal: cash.cashSalesTotal,
      otherSalesTotal,
      totalSales: cash.cashSalesTotal + otherSalesTotal,
      expectedCash: cash.expectedCash,
      totalTransactions: activeSales.length,
      cashDebtTotal: cash.cashDebtReceived,
      cashRefunds: cash.cashRefunds,
      transferDebtTotal: cash.transferDebtReceived,
      totalDebtPayments: shiftDebtPayments.filter(p => p.type !== 'refund').length,
      totalExpenses: cash.totalExpenses,
      totalCapital: cash.totalCapital,
      totalReturns: cash.totalReturns,
    };
  }, [activeShift, shiftSales, shiftDebtPayments, shiftExpenses, shiftCapitals, shiftReturns]);

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
        <DialogHeader className="p-5 pb-3 gap-1 text-left shrink-0 border-b border-border">
          <DialogTitle className="tracking-tight">Cerrar Caja</DialogTitle>
          <DialogDescription>
            Realiza el arqueo y cierra el turno actual
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto min-h-0">

        {/* Shift Duration Badge */}
        <div className="px-5 pt-4 pb-3">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs font-medium text-muted-foreground tabular-nums">
            <Clock className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
            Turno activo: {shiftDuration}
          </div>
        </div>

        {/* Sales Summary Section */}
        <div className="px-5 pb-3">
          <div className="rounded-lg border border-border bg-card divide-y divide-border">
            {/* Revenue Overview */}
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                <TrendingUp className="h-3 w-3" strokeWidth={1.75} />
                Resumen de Ventas
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2.5 rounded-md bg-muted/50 min-w-0">
                  <p className="text-2xl font-semibold tracking-tight tabular-nums">{totalTransactions}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Transacciones</p>
                </div>
                <div className="text-center p-2.5 rounded-md bg-muted/50 min-w-0">
                  <p className="text-sm font-semibold font-mono tabular-nums truncate" title={formatCurrency(totalSales)}>{formatCurrency(totalSales)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Ventas Totales</p>
                </div>
                <div className="text-center p-2.5 rounded-md bg-muted/50 min-w-0">
                  <p className="text-sm font-semibold font-mono tabular-nums truncate" title={formatCurrency(totalTransactions > 0 ? totalSales / totalTransactions : 0)}>{formatCurrency(totalTransactions > 0 ? totalSales / totalTransactions : 0)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Ticket Promedio</p>
                </div>
              </div>
            </div>

            {/* Payment Breakdown */}
            <div className="p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
                  <Banknote className="h-4 w-4" strokeWidth={1.75} />
                  <span>Efectivo</span>
                </div>
                <span className="text-sm font-medium font-mono tabular-nums truncate" title={formatCurrency(cashSalesTotal)}>{formatCurrency(cashSalesTotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
                  <CreditCard className="h-4 w-4" strokeWidth={1.75} />
                  <span>Tarjeta / Transferencia</span>
                </div>
                <span className="text-sm font-medium font-mono tabular-nums truncate" title={formatCurrency(otherSalesTotal)}>{formatCurrency(otherSalesTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Abonos Section */}
        {(shiftDebtPayments.length > 0) && (
          <div className="px-5 pb-3">
            <div className="rounded-lg border border-border bg-card divide-y divide-border">
              <div className="p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  <HandCoins className="h-3 w-3" strokeWidth={1.75} />
                  Abonos a Deudas ({totalDebtPayments})
                </div>
                {cashDebtTotal > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
                      <Banknote className="h-4 w-4" strokeWidth={1.75} />
                      <span>Efectivo</span>
                    </div>
                    <span className="text-sm font-medium font-mono tabular-nums text-emerald-600 dark:text-emerald-400">+{formatCurrency(cashDebtTotal)}</span>
                  </div>
                )}
                {transferDebtTotal > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
                      <CreditCard className="h-4 w-4" strokeWidth={1.75} />
                      <span>Transferencia</span>
                    </div>
                    <span className="text-sm font-medium font-mono tabular-nums">{formatCurrency(transferDebtTotal)}</span>
                  </div>
                )}
                {cashRefunds > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
                      <ArrowDownCircle className="h-4 w-4 text-destructive" strokeWidth={1.75} />
                      <span>Reembolsos (ventas fiadas anuladas)</span>
                    </div>
                    <span className="text-sm font-medium font-mono tabular-nums text-destructive">-{formatCurrency(cashRefunds)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Cash Reconciliation */}
        <div className="px-5 pb-3 space-y-2">
          <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            <Wallet className="h-3 w-3" strokeWidth={1.75} />
            Arqueo de Caja
          </div>

          <div className="rounded-lg border border-border divide-y divide-border text-sm">
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
              <span className="text-sm text-muted-foreground shrink-0">Fondo inicial</span>
              <span className="text-sm font-medium font-mono tabular-nums truncate">{formatCurrency(initialCash)}</span>
            </div>
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
              <span className="text-sm text-muted-foreground shrink-0">+ Ventas en efectivo</span>
              <span className="text-sm font-medium font-mono tabular-nums truncate text-emerald-600 dark:text-emerald-400">+{formatCurrency(cashSalesTotal)}</span>
            </div>
            {cashDebtTotal > 0 && (
              <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                <span className="text-sm text-muted-foreground shrink-0">+ Abonos en efectivo</span>
                <span className="text-sm font-medium font-mono tabular-nums truncate text-emerald-600 dark:text-emerald-400">+{formatCurrency(cashDebtTotal)}</span>
              </div>
            )}
            {totalCapital > 0 && (
              <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                <span className="text-sm text-muted-foreground shrink-0">+ Inyecciones de capital</span>
                <span className="text-sm font-medium font-mono tabular-nums truncate text-emerald-600 dark:text-emerald-400">+{formatCurrency(totalCapital)}</span>
              </div>
            )}
            {cashRefunds > 0 && (
              <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-red-500/5">
                <span className="text-sm text-destructive font-medium shrink-0">- Reembolsos en efectivo</span>
                <span className="text-sm font-semibold font-mono tabular-nums truncate text-destructive">-{formatCurrency(cashRefunds)}</span>
              </div>
            )}
            {totalReturns > 0 && (
              <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-red-500/5">
                <span className="text-sm text-destructive font-medium shrink-0">- Devoluciones (efectivo)</span>
                <span className="text-sm font-semibold font-mono tabular-nums truncate text-destructive">-{formatCurrency(totalReturns)}</span>
              </div>
            )}
            {totalExpenses > 0 && (
              <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-red-500/5">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-destructive font-medium">- Salidas de caja (Gastos)</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setShowExpensesList(true)}
                    aria-label="Ver detalle de salidas de caja"
                    title="Ver detalle"
                  >
                    <Eye className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                  </Button>
                </div>
                <span className="text-sm font-semibold font-mono tabular-nums truncate text-destructive">-{formatCurrency(totalExpenses)}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-muted/50">
              <span className="text-sm font-semibold shrink-0">Efectivo esperado</span>
              <span className="text-sm font-semibold font-mono tabular-nums truncate">{formatCurrency(expectedCash)}</span>
            </div>
          </div>
        </div>

        {/* Cash Count Input */}
        <div className="px-5 pb-3 space-y-1.5">
          <Label htmlFor="final-cash" className="text-sm font-medium">
            Efectivo contado en caja
          </Label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground pointer-events-none" aria-hidden="true">
              {getCurrencySymbol()}
            </div>
            <Input
              ref={inputRef}
              id="final-cash"
              type="text"
              inputMode="decimal"
              value={finalCash}
              onChange={handleAmountChange}
              placeholder="0.00"
              aria-describedby={difference !== null ? "cash-difference" : undefined}
              className="h-12 text-lg! text-right font-semibold tabular-nums pl-18 pr-5 rounded-lg bg-background"
              style={{ fontSize: '1.25rem' }}
              disabled={isLoading}
            />
          </div>
        </div>

        {/* Denomination Counter (collapsible) */}
        <div className="px-5 pb-3">
          <button
            type="button"
            onClick={() => setShowCounter(v => !v)}
            disabled={isLoading}
            aria-expanded={showCounter}
            aria-controls="cash-counter"
            className="inline-flex items-center gap-1.5 h-8 -ml-1 px-1 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-[1px] focus-visible:ring-ring"
          >
            <Calculator className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            Contar efectivo
            {showCounter ? (
              <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            )}
          </button>

          {showCounter && (
            <div id="cash-counter" className="mt-2 rounded-lg border border-border">
              <div className="max-h-64 overflow-y-auto divide-y divide-border">
                {denominations.map((denomination) => {
                  const key = String(denomination);
                  const qty = parseInt(counts[key] ?? '', 10) || 0;
                  return (
                    <div
                      key={key}
                      className="grid grid-cols-[1fr_5rem_1fr] items-center gap-3 px-3.5 py-1.5"
                    >
                      <span className="text-sm text-muted-foreground font-mono tabular-nums truncate">
                        {formatCurrency(denomination)}
                      </span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={counts[key] ?? ''}
                        onChange={(e) => handleCountChange(denomination, e.target.value)}
                        placeholder="0"
                        aria-label={`Cantidad de ${formatCurrency(denomination)}`}
                        className="h-9 text-right font-mono tabular-nums"
                        disabled={isLoading}
                      />
                      <span className="text-sm font-mono tabular-nums text-muted-foreground text-right truncate" title={formatCurrency(denominationSubtotal(denomination, qty))}>
                        {formatCurrency(denominationSubtotal(denomination, qty))}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-t border-border bg-muted/50">
                <span className="text-sm font-semibold shrink-0">Total contado</span>
                <span className="text-sm font-semibold font-mono tabular-nums truncate" title={formatCurrency(countTotal)}>
                  {formatCurrency(countTotal)}
                </span>
              </div>
              <div className="flex items-center gap-2 px-3.5 py-2.5 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearCounts}
                  disabled={isLoading || !hasCounted}
                  className="h-9"
                >
                  Limpiar
                </Button>
                <Button
                  onClick={handleUseCountTotal}
                  disabled={isLoading || !hasCounted}
                  className="h-9 flex-1"
                >
                  Usar este total
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Difference Indicator */}
        {difference !== null && (
          <div className="px-5 pb-3">
            <div
              id="cash-difference"
              role="status"
              aria-live="polite"
              className={cn(
                "flex items-center justify-between gap-3 p-3.5 rounded-lg border",
                difference === 0
                  ? "bg-emerald-500/10 border-emerald-500/20"
                  : difference < 0
                    ? "bg-red-500/10 border-red-500/20"
                    : "bg-amber-500/10 border-amber-500/20"
              )}
            >
              <div className="flex items-center gap-2">
                {difference === 0 ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} aria-hidden="true" />
                ) : difference < 0 ? (
                  <ArrowDownCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" strokeWidth={1.75} aria-hidden="true" />
                ) : (
                  <ArrowUpCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" strokeWidth={1.75} aria-hidden="true" />
                )}
                <div>
                  <p className={cn(
                    "text-sm font-semibold",
                    difference === 0 ? "text-emerald-600 dark:text-emerald-400"
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
              <span
                className={cn(
                  "text-sm font-semibold font-mono tabular-nums shrink-0",
                  difference === 0 ? "text-emerald-600 dark:text-emerald-400"
                    : difference < 0 ? "text-red-700 dark:text-red-400"
                      : "text-amber-700 dark:text-amber-400"
                )}
                title={`${difference > 0 ? '+' : ''}${formatCurrency(difference)}`}
              >
                {difference > 0 ? '+' : ''}{formatCurrency(difference)}
              </span>
            </div>
          </div>
        )}

        </div>{/* end scrollable */}

        {/* Actions */}
        <div className="p-5 pt-3 border-t border-border flex gap-3 shrink-0">
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
            aria-busy={isLoading}
            className="flex-1 h-11"
            variant={difference !== null && difference < 0 ? "destructive" : "default"}
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Cerrando...</>
            ) : (
              <><LockKeyhole className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />Cerrar Turno</>
            )}
          </Button>
        </div>
      </DialogContent>

      <ViewExpensesDialog 
        isOpen={showExpensesList}
        onClose={() => setShowExpensesList(false)}
      />
    </Dialog>
  );
}
