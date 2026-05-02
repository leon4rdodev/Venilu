import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent } from '@components/ui/dialog';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Textarea } from '@components/ui/textarea';
import { ReceiptPoundSterling, MinusCircle, AlertCircle, Wallet, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useShift } from '../hooks/use-shift';
import { getCurrencySymbol } from '@lib/currency';
import { cn } from '@lib/utils';

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
        <div className="p-6 pb-4 space-y-1 border-b">
          <div className="flex items-center gap-2 text-destructive">
            <MinusCircle className="h-5 w-5" />
            <h2 className="text-xl font-semibold tracking-tight">Registrar Salida de Efectivo</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Registra gastos o retiros de efectivo realizados durante el turno
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="p-6 space-y-5">
            {/* Warning info */}
            <div className="bg-destructive/5 p-3.5 rounded-lg flex gap-3 text-xs text-destructive border border-destructive/10 leading-relaxed">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p>Este retiro se restará automáticamente del arqueo final de caja. Asegúrate de conservar el comprobante físico si es necesario.</p>
            </div>

            {/* Amount Field */}
            <div className="space-y-2">
              <Label htmlFor="amount" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                Monto del Retiro
              </Label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground/60 group-focus-within:text-destructive transition-colors">
                  {getCurrencySymbol()}
                </div>
                <Input
                  ref={inputRef}
                  id="amount"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  className={cn(
                    "h-16 text-2xl! pl-12 pr-5 font-bold text-right transition-all",
                    "bg-muted/30 border-muted-foreground/20 focus:bg-background focus:ring-destructive/20 focus:border-destructive"
                  )}
                  style={{ fontSize: '1.5rem' }}
                  value={amount}
                  onChange={handleAmountChange}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Reason Field */}
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                Motivo o Concepto
              </Label>
              <div className="relative group">
                <Textarea
                  id="reason"
                  placeholder="Ej: Pago de delivery, Compra de suministros, Retiro parcial..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className={cn(
                    "resize-none h-28 pt-3 pb-3 transition-all",
                    "bg-muted/30 border-muted-foreground/20 focus:bg-background focus:ring-destructive/20 focus:border-destructive"
                  )}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Visual indicator of what's happening */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-dashed border-muted-foreground/30">
               <div className="h-8 w-8 rounded-full bg-background flex items-center justify-center border shrink-0">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
               </div>
               <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40" />
               <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center border border-destructive/20 shrink-0">
                  <ReceiptPoundSterling className="h-4 w-4 text-destructive" />
               </div>
               <div className="ml-auto text-[11px] text-muted-foreground font-medium italic">
                  Ajuste de caja directo
               </div>
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 pt-2 border-t bg-muted/5 flex gap-3">
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
              className="flex-1 h-11 gap-2 shadow-lg shadow-destructive/10"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Registrando...
                </>
              ) : (
                <><MinusCircle className="h-4 w-4" /> Registrar Retiro</>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
