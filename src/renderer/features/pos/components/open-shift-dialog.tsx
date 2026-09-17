
import React, { useState, useRef, useEffect } from 'react';
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
import { getCurrencySymbol } from '@lib/currency';

import { useShift } from '../hooks/use-shift';
import { useUser } from '@renderer/features/auth';
import { toast } from 'sonner';
import { formatCurrency } from '@lib/currency';
import { Banknote, History, PlayCircle, Loader2 } from 'lucide-react';
import { cn } from '@lib/utils';

interface OpenShiftDialogProps {
  isOpen: boolean;
  onClose?: () => void;
}

interface LastClosedShift {
  id: string;
  end_time: string;
  initial_cash: number;
  final_cash?: number;
  expected_cash?: number;
  difference?: number;
}

/** "Hoy 20:45" / "Ayer 20:45" / "12 ago, 20:45" */
function formatRecency(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const time = date.toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', hour12: false });
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(date); day.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (diffDays === 0) return `Hoy ${time}`;
  if (diffDays === 1) return `Ayer ${time}`;
  return `${date.toLocaleDateString('es-DO', { day: '2-digit', month: 'short' })}, ${time}`;
}

export function OpenShiftDialog({ isOpen, onClose }: OpenShiftDialogProps) {
  const [initialCash, setInitialCash] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastClosed, setLastClosed] = useState<LastClosedShift | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { openShift } = useShift();
  const { user } = useUser();

  // On open: focus the cash input and fetch the previous shift's closing cash
  // so the cashier can carry the float over with one click.
  useEffect(() => {
    if (!isOpen) return;
    const id = setTimeout(() => inputRef.current?.focus(), 50);

    let cancelled = false;
    window.ipcRenderer
      .invoke('shifts:getLastClosed')
      .then((res: any) => {
        if (!cancelled && res?.success) setLastClosed(res.data ?? null);
      })
      .catch(() => { /* suggestion is best-effort */ });

    return () => { cancelled = true; clearTimeout(id); };
  }, [isOpen]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setInitialCash(value);
    }
  };

  const isValidAmount = initialCash !== '' && !isNaN(parseFloat(initialCash)) && parseFloat(initialCash) >= 0;

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && isValidAmount && !isLoading) {
      e.preventDefault();
      handleOpenShift();
    }
  };

  const quickAmounts = [0, 500, 1000, 2000, 5000];
  const suggestedCash = lastClosed?.final_cash;
  const userInitial = (user?.username?.[0] ?? '?').toUpperCase();
  const nowLabel = new Date().toLocaleDateString('es-DO', {
    weekday: 'short', day: '2-digit', month: 'short',
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
      <DialogContent
        className="sm:max-w-sm p-0 gap-0 overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <DialogHeader className="p-6 pb-4 gap-1 text-left border-b border-border">
          <DialogTitle className="tracking-tight">Abrir Caja</DialogTitle>
          <DialogDescription>
            Registra el fondo inicial para comenzar tu turno
          </DialogDescription>
        </DialogHeader>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Who opens + when — the shift is registered to this user */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold" aria-hidden="true">
                {userInitial}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" title={user?.username ?? 'Usuario'}>{user?.username ?? 'Usuario'}</p>
                <p className="text-xs text-muted-foreground">Responsable del turno</p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground capitalize whitespace-nowrap">{nowLabel}</span>
          </div>

          {/* Input */}
          <div className="space-y-1.5">
            <Label
              htmlFor="initial-cash"
              className="gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider"
            >
              <Banknote className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
              Fondo de caja inicial
            </Label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-muted-foreground pointer-events-none" aria-hidden="true">
                {getCurrencySymbol()}
              </div>
              <Input
                ref={inputRef}
                id="initial-cash"
                type="text"
                inputMode="decimal"
                value={initialCash}
                onChange={handleAmountChange}
                onKeyDown={handleKeyDown}
                placeholder="0.00"
                className="h-12 text-lg! text-right font-semibold tabular-nums pl-18 pr-5 rounded-lg bg-background"
                style={{ fontSize: '1.25rem' }}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Previous close suggestion — cash continuity between shifts */}
          {suggestedCash !== undefined && suggestedCash !== null && (
            <button
              type="button"
              onClick={() => setInitialCash(String(suggestedCash))}
              disabled={isLoading}
              aria-pressed={initialCash === String(suggestedCash)}
              className={cn(
                'w-full flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
                'focus-visible:outline-none focus-visible:ring-[1px] focus-visible:ring-ring focus-visible:border-ring',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                initialCash === String(suggestedCash)
                  ? 'border-primary bg-muted'
                  : 'border-border bg-background hover:bg-muted/60',
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 shrink-0 rounded-full bg-muted text-foreground flex items-center justify-center" aria-hidden="true">
                  <History className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium">Efectivo del último cierre</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {formatRecency(lastClosed!.end_time)}
                  </p>
                </div>
              </div>
              <span className="text-sm font-semibold font-mono tabular-nums whitespace-nowrap" title={formatCurrency(suggestedCash)}>
                {formatCurrency(suggestedCash)}
              </span>
            </button>
          )}

          {/* Quick amounts */}
          <div className="space-y-2">
            <span id="quick-amounts-label" className="block text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
              Selección rápida
            </span>
            <div className="grid grid-cols-3 gap-1.5" role="group" aria-labelledby="quick-amounts-label">
              {quickAmounts.map((amount) => {
                const isSelected = initialCash === String(amount);
                return (
                  <button
                    key={amount}
                    type="button"
                    aria-pressed={isSelected}
                    className={cn(
                      'h-8 rounded-full text-xs font-medium tabular-nums border transition-colors truncate px-2',
                      'focus-visible:outline-none focus-visible:ring-[1px] focus-visible:ring-ring focus-visible:border-ring',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-muted border-border',
                    )}
                    onClick={() => setInitialCash(String(amount))}
                    disabled={isLoading}
                    title={formatCurrency(amount)}
                  >
                    {formatCurrency(amount)}
                  </button>
                );
              })}
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            El fondo inicial quedará registrado y se usará para el arqueo al cerrar el turno.
          </p>
        </div>

        {/* Actions */}
        <div className="p-6 pt-4 border-t border-border">
          <Button
            onClick={handleOpenShift}
            disabled={isLoading || !isValidAmount}
            aria-busy={isLoading}
            className="w-full h-10 gap-2"
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Abriendo...</>
            ) : (
              <><PlayCircle className="h-4 w-4" strokeWidth={1.75} />Iniciar Turno</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
