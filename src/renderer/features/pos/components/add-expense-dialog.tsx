import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@components/ui/dialog';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { MinusCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useShift } from '../hooks/use-shift';
import { getCurrencySymbol } from '@lib/currency';

interface AddExpenseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddExpenseDialog({ isOpen, onClose, onSuccess }: AddExpenseDialogProps) {
  const { activeShift, addExpenseToShift } = useShift();
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

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
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

      const result = await window.ipcRenderer.invoke('shifts:add-expense', {
        shiftId: activeShift.id,
        amount: numAmount,
        reason: reason.trim()
      }) as { success: boolean; data?: any; message?: string };

      if (result.success) {
        toast.success('Gasto registrado correctamente');
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

  const isValid = amount !== '' && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && reason.trim().length > 0;

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
            {/* Warning info */}
            <div role="note" className="bg-destructive/10 p-3.5 rounded-lg flex gap-3 text-xs text-destructive border border-destructive/20 leading-relaxed">
              <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <p>Este retiro se restará automáticamente del arqueo final de caja. Asegúrate de conservar el comprobante físico si es necesario.</p>
            </div>

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
                className="resize-none h-24 bg-background"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="p-5 pt-4 border-t border-border flex gap-3">
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
        </form>
      </DialogContent>
    </Dialog>
  );
}
