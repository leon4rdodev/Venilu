import { useState, useRef, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@components/ui/dialog';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { MinusCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useShift } from '../hooks/use-shift';
import { formatCurrency, getCurrencySymbol } from '@lib/currency';
import { computeShiftCash } from '@shared/cash-reconciliation';
import { round2 } from '@shared/money';

interface AddExpenseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/** Montos frecuentes para retiros rápidos (1 clic) */
const QUICK_AMOUNTS = [100, 500, 1000, 2000];
const REASON_SUGGESTIONS = ['Retiro de caja', 'Pago a proveedor', 'Delivery', 'Compra local'];

export function AddExpenseDialog({ isOpen, onClose, onSuccess }: AddExpenseDialogProps) {
  const {
    activeShift, addExpenseToShift,
    shiftSales, shiftDebtPayments, shiftExpenses, shiftReturns, shiftCapitals,
  } = useShift();
  const [amount, setAmount] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const id = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [isOpen]);

  // Efectivo esperado en caja AHORA (misma fórmula del arqueo) para
  // previsualizar en qué queda la caja antes de confirmar el retiro.
  const cashPreview = useMemo(() => {
    if (!activeShift) return null;
    return computeShiftCash({
      initialCash: activeShift.initial_cash,
      sales: shiftSales,
      debtPayments: shiftDebtPayments,
      expenses: shiftExpenses,
      returns: shiftReturns,
      capital: shiftCapitals,
    });
  }, [activeShift, shiftSales, shiftDebtPayments, shiftExpenses, shiftReturns, shiftCapitals]);

  const amountValue = parseFloat(amount);
  const hasAmount = Number.isFinite(amountValue) && amountValue > 0;
  const cashAfter = cashPreview && hasAmount ? round2(cashPreview.expectedCash - amountValue) : null;
  const exceedsAvailable = cashPreview !== null && hasAmount && amountValue > cashPreview.expectedCash;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setAmount(value);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!activeShift) {
      toast.error('No hay un turno activo');
      return;
    }

    if (!hasAmount) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }

    if (!reason.trim()) {
      toast.error('Debes especificar un motivo');
      return;
    }

    setIsSubmitting(true);
    try {
      if (!window.ipcRenderer) throw new Error("IPC Renderer no disponible");

      interface ShiftExpense {
        id: number;
        shiftId: number;
        amount: number;
        reason: string;
        createdAt: string;
      }

      const result = await window.ipcRenderer.invoke('shifts:add-expense', {
        shiftId: activeShift.id,
        amount: amountValue,
        reason: reason.trim()
      }) as { success: boolean; data?: ShiftExpense; message?: string };

      if (result.success) {
        toast.success(`Salida de ${formatCurrency(amountValue)} registrada`);
        addExpenseToShift(result.data);
        setAmount('');
        setReason('');
        onSuccess?.();
        onClose();
      } else {
        toast.error(result.message || 'Error al registrar gasto');
      }
    } catch (error) {
      console.error('Error adding expense:', error);
      toast.error('Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = hasAmount && reason.trim().length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 gap-1 text-left border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0" aria-hidden="true">
              <MinusCircle className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <DialogTitle className="tracking-tight">Registrar Salida de Efectivo</DialogTitle>
          </div>
          <DialogDescription className="ml-[42px]">
            Registra gastos o retiros de efectivo realizados durante el turno
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="p-5 space-y-4">
            {/* Amount Field */}
            <div className="space-y-1.5">
              <Label htmlFor="expense-amount" className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Monto del Retiro
              </Label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground pointer-events-none" aria-hidden="true">
                  {getCurrencySymbol()}
                </div>
                <Input
                  ref={inputRef}
                  id="expense-amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  className="h-12 text-lg! pl-18 pr-5 font-semibold tabular-nums text-right rounded-lg bg-background"
                  style={{ fontSize: '1.25rem' }}
                  value={amount}
                  onChange={handleAmountChange}
                  disabled={isSubmitting}
                />
              </div>

              {/* Quick amounts */}
              <div className="flex flex-wrap gap-1.5 pt-0.5" role="group" aria-label="Montos frecuentes">
                {QUICK_AMOUNTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setAmount(String(q))}
                    disabled={isSubmitting}
                    className="px-3 h-8 rounded-full border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors outline-none focus-visible:ring-[1px] focus-visible:ring-ring"
                  >
                    {getCurrencySymbol()}{q}
                  </button>
                ))}
              </div>

              {/* Live preview: cuánto queda en caja tras el retiro */}
              {cashPreview && (
                <p className="text-xs text-muted-foreground tabular-nums pt-0.5" aria-live="polite">
                  Esperado en caja:{' '}
                  <span className="font-medium text-foreground">{formatCurrency(cashPreview.expectedCash)}</span>
                  {hasAmount && cashAfter !== null && (
                    <>
                      {' → '}tras el retiro:{' '}
                      <span className={`font-medium ${exceedsAvailable ? 'text-destructive' : 'text-foreground'}`}>
                        {formatCurrency(cashAfter)}
                      </span>
                    </>
                  )}
                </p>
              )}
              {exceedsAvailable && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Este retiro excede el efectivo esperado en caja — revisa el monto.
                </p>
              )}
            </div>

            {/* Reason Field */}
            <div className="space-y-1.5">
              <Label htmlFor="expense-reason" className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Motivo o Concepto
              </Label>
              <Textarea
                id="expense-reason"
                placeholder="Ej: Pago de delivery, Compra de suministros, Retiro parcial..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="resize-none h-20 bg-background"
                disabled={isSubmitting}
              />
              {/* Quick reasons */}
              <div className="flex flex-wrap gap-1.5 pt-0.5" role="group" aria-label="Motivos frecuentes">
                {REASON_SUGGESTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    disabled={isSubmitting}
                    className="px-3 h-8 rounded-full border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors outline-none focus-visible:ring-[1px] focus-visible:ring-ring"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Warning info */}
            <div role="note" className="bg-destructive/10 p-3.5 rounded-lg flex gap-3 text-xs text-destructive border border-destructive/20 leading-relaxed">
              <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <p>Se descontará del arqueo final de caja. Conserva el comprobante físico si lo necesitas.</p>
            </div>
          </div>

          {/* Actions */}
          <div className="p-5 pt-4 border-t border-border space-y-3">
            {!isValid && (
              <p className="text-xs text-muted-foreground text-center">
                Completa el monto y el motivo para poder registrar.
              </p>
            )}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 h-11"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isSubmitting || !isValid}
                aria-busy={isSubmitting}
                className="flex-1 h-11 gap-2"
              >
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Registrando...</>
                ) : (
                  <><MinusCircle className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />Registrar Retiro</>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
