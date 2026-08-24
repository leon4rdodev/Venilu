
import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
} from '@components/ui/dialog';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { getCurrencySymbol } from '@lib/currency';

import { useShift } from '../hooks/use-shift';
import { useUser } from '@renderer/features/auth';
import { toast } from 'sonner';
import { formatCurrency } from '@lib/currency';
import { Banknote, LogOut, PlayCircle } from 'lucide-react';
import { cn } from '@lib/utils';

interface OpenShiftDialogProps {
  isOpen: boolean;
  onClose?: () => void;
}

export function OpenShiftDialog({ isOpen, onClose }: OpenShiftDialogProps) {
  const [initialCash, setInitialCash] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { openShift } = useShift();
  const { logout } = useUser();

  // Focus the cash input when the dialog opens
  useEffect(() => {
    if (isOpen) {
      const id = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [isOpen]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setInitialCash(value);
    }
  };

  const handleOpenShift = async () => {
    const cashAmount = parseFloat(initialCash);
    if (isNaN(cashAmount) || cashAmount < 0) {
      toast.error('Monto inválido', {
        description: 'Por favor, introduce un monto de efectivo inicial válido.',
      });
      return;
    }

    setIsLoading(true);
    const result = await openShift(cashAmount);
    setIsLoading(false);

    if (result.success) {
      toast.success('Turno iniciado', {
        description: `La caja se ha abierto con ${formatCurrency(cashAmount)}.`,
      });
      setInitialCash('');
      onClose?.();
    } else {
      toast.error('Error al abrir turno', {
        description: result.message || 'Ocurrió un error inesperado.',
      });
    }
  };

  const isValidAmount = initialCash !== '' && !isNaN(parseFloat(initialCash)) && parseFloat(initialCash) >= 0;
  const quickAmounts = [0, 500, 1000, 2000, 5000];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent
        className="sm:max-w-sm p-0 gap-0 overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="p-5 pb-3 space-y-1 border-b border-border">
          <h2 className="text-lg font-semibold tracking-tight">Abrir Caja</h2>
          <p className="text-sm text-muted-foreground">
            Registra el fondo inicial para comenzar tu turno
          </p>
        </div>

        {/* Content */}
        <div className="px-5 pt-4 pb-4">
          {/* Input */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <Banknote className="h-3 w-3" strokeWidth={1.75} />
              Fondo de caja inicial
            </div>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground pointer-events-none">
                {getCurrencySymbol()}
              </div>
              <Input
                ref={inputRef}
                id="initial-cash"
                type="text"
                inputMode="decimal"
                value={initialCash}
                onChange={handleAmountChange}
                placeholder="0.00"
                className="h-12 text-lg! text-right font-semibold tabular-nums pl-18 pr-5 bg-background"
                style={{ fontSize: '1.25rem' }}
                disabled={isLoading}
              />
            </div>
          </div>
        </div>

        {/* Quick amounts */}
        <div className="px-5 pb-4 space-y-2">
          <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
            Selección rápida
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {quickAmounts.map((amount) => {
              const isSelected = initialCash === String(amount);
              return (
                <button
                  key={amount}
                  className={cn(
                    "py-2 rounded-md text-xs font-medium tabular-nums border transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-border"
                  )}
                  onClick={() => setInitialCash(String(amount))}
                  disabled={isLoading}
                >
                  {amount === 0 ? formatCurrency(0) : formatCurrency(amount)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 pt-3 border-t border-border flex gap-3">
          <Button
            variant="ghost"
            onClick={logout}
            disabled={isLoading}
            className="h-11 gap-1.5 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Salir
          </Button>
          <div className="flex-1" />
          <Button
            onClick={handleOpenShift}
            disabled={isLoading || !isValidAmount}
            className="h-11 px-8"
          >
            {isLoading ? (
              <>Abriendo...</>
            ) : (
              <><PlayCircle className="h-4 w-4" />Iniciar Turno</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
