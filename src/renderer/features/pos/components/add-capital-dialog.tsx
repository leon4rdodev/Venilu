import { useState, useRef, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@components/ui/dialog';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { PlusCircle, Info, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useShift } from '../hooks/use-shift';
import { formatCurrency, getCurrencySymbol } from '@lib/currency';
import { computeShiftCash } from '@shared/cash-reconciliation';
import { round2 } from '@shared/money';

interface AddCapitalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/** Montos frecuentes para aportes rápidos (1 clic) */
const QUICK_AMOUNTS = [100, 500, 1000, 2000];

export function AddCapitalDialog({ isOpen, onClose, onSuccess }: AddCapitalDialogProps) {
  const {
    activeShift, addCapitalToShift,
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

  // Misma fórmula del arqueo: previsualiza cuánto queda en caja tras el aporte.
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
  const cashAfter = cashPreview && hasAmount ? round2(cashPreview.expectedCash + amountValue) : null;

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

    setIsSubmitting(true);
    try {
      if (!window.ipcRenderer) throw new Error("IPC Renderer no disponible");

      const result = await window.ipcRenderer.invoke('shifts:add-capital', {
        shiftId: activeShift.id,
        amount: amountValue,
        reason: reason.trim()
      }) as { success: boolean; data?: any; message?: string };

      if (result.success) {
        toast.success(`Inyección de ${formatCurrency(amountValue)} registrada`);
        addCapitalToShift(result.data);
        setAmount('');
        setReason('');
        onSuccess?.();
        onClose();
      } else {
        toast.error(result.message || 'Error al registrar la inyección');
      }
    } catch (error) {
      console.error('Error adding capital:', error);
      toast.error('Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 gap-1 text-left border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0" aria-hidden="true">
              <PlusCircle className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <DialogTitle className="tracking-tight">Inyectar Capital en Caja</DialogTitle>
          </div>
          <DialogDescription className="ml-[42px]">
            Aporta efectivo a la caja durante el turno (fondo extra, cambio para caja…)
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="p-5 space-y-4">
            {/* Amount Field */}
            <div className="space-y-1.5">
              <Label htmlFor="capital-amount" className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Monto a Inyectar
              </Label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground pointer-events-none" aria-hidden="true">
                  {getCurrencySymbol()}
                </div>
                <Input
                  ref={inputRef}
                  id="capital-amount"
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

              {/* Live preview: cuánto queda en caja tras el aporte */}
              {cashPreview && (
                <p className="text-xs text-muted-foreground tabular-nums pt-0.5" aria-live="polite">
                  Esperado en caja:{' '}
                  <span className="font-medium text-foreground">{formatCurrency(cashPreview.expectedCash)}</span>
                  {hasAmount && cashAfter !== null && (
                    <>
                      {' → '}tras la inyección:{' '}
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(cashAfter)}
                      </span>
                    </>
                  )}
                </p>
              )}
            </div>

            {/* Note */}
            <div role="note" className="bg-emerald-500/10 p-3.5 rounded-lg flex gap-3 text-xs text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 leading-relaxed">
              <Info className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <p>Sumará al efectivo esperado en el arqueo de cierre de turno.</p>
            </div>

            {/* Reason Field (opcional) */}
            <div className="space-y-1.5">
              <Label htmlFor="capital-reason" className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Motivo (opcional)
              </Label>
              <Input
                id="capital-reason"
                type="text"
                placeholder="Ej: Aporte del dueño, fondo extra para caja..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="h-10 bg-background"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="p-5 pt-4 border-t border-border space-y-3">
            {!hasAmount && (
              <p className="text-xs text-muted-foreground text-center">
                Indica un monto para poder registrar.
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
                disabled={isSubmitting || !hasAmount}
                aria-busy={isSubmitting}
                className="flex-1 h-11 gap-2 bg-emerald-600 hover:bg-emerald-500 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500"
              >
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Registrando...</>
                ) : (
                  <><PlusCircle className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />Registrar Inyección</>
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
