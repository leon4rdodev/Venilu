import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@components/ui/dialog';
import { Button } from '@components/ui/button';
import { formatCurrency } from '@lib/currency';
import { formatTime } from '@lib/formatters';
import { ReceiptPoundSterling, LayoutList, Undo2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useShift } from '../hooks/use-shift';
import { usePermission } from '@renderer/features/auth/hooks/use-permission';
import { PERMISSIONS } from '@shared/permissions';

interface ViewExpensesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  expenses?: any[];
  title?: string;
}

export function ViewExpensesDialog({ isOpen, onClose, expenses, title }: ViewExpensesDialogProps) {
  const { shiftExpenses: currentShiftExpenses, removeExpenseFromShift } = useShift();
  const canManage = usePermission(PERMISSIONS.SHIFTS_EXPENSES);

  // Sin lista explícita mostramos las salidas del turno ACTUAL (abierto):
  // solo ahí se puede deshacer — un turno cerrado ya tiene arqueo y no
  // puede alterarse.
  const isCurrentShift = expenses === undefined;
  const canUndo = isCurrentShift && canManage;

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setConfirmingId(null);
      setPendingId(null);
    }
  }, [isOpen]);

  const displayExpenses = expenses || currentShiftExpenses;
  const totalExpenses = displayExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const handleUndo = async (expense: any) => {
    if (!expense?.id || pendingId) return;
    setPendingId(expense.id);
    try {
      if (!window.ipcRenderer) throw new Error("IPC Renderer no disponible");

      const result = await window.ipcRenderer.invoke('shifts:delete-expense', {
        expenseId: expense.id,
      }) as { success: boolean; message?: string };

      if (result.success) {
        toast.success(`Salida de ${formatCurrency(Number(expense.amount))} deshecha`);
        if (isCurrentShift) removeExpenseFromShift(expense.id);
        setConfirmingId(null);
      } else {
        toast.error(result.message || 'No se pudo deshacer la salida');
      }
    } catch (error) {
      console.error('Error undoing expense:', error);
      toast.error('Error de conexión');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden max-h-[80vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 gap-1 text-left border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0" aria-hidden="true">
              <LayoutList className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <DialogTitle className="tracking-tight truncate" title={title || 'Salidas de Efectivo'}>
              {title || 'Salidas de Efectivo'}
            </DialogTitle>
          </div>
          <DialogDescription className="ml-[42px]">
            Listado detallado de retiros realizados {title ? 'en este turno' : 'en el turno actual'}
            {canUndo && '. Puedes deshacer cualquier salida mientras el turno siga abierto.'}
          </DialogDescription>
        </DialogHeader>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-1">
          {displayExpenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3" aria-hidden="true">
                <ReceiptPoundSterling className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No hay salidas registradas</p>
            </div>
          ) : (
            <ul className="divide-y divide-border" aria-label="Salidas de efectivo">
              {[...displayExpenses].reverse().map((expense, idx) => (
                <li
                  key={expense.id ?? idx}
                  className="py-3 flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate" title={expense.reason}>
                      {expense.reason}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatTime(expense.created_at)}
                    </p>
                  </div>
                  {confirmingId === expense.id ? (
                    /* Step 2: inline confirmation — no window.confirm */
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">¿Deshacer?</span>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 px-2.5 text-xs"
                        disabled={pendingId === expense.id}
                        onClick={() => handleUndo(expense)}
                      >
                        {pendingId === expense.id
                          ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                          : 'Sí, deshacer'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        disabled={pendingId === expense.id}
                        onClick={() => setConfirmingId(null)}
                      >
                        No
                      </Button>
                    </div>
                  ) : (
                    /* Step 1: amount + undo trigger */
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-medium text-destructive font-mono tabular-nums">
                        -{formatCurrency(Number(expense.amount))}
                      </span>
                      {canUndo && expense.id && (
                        <button
                          type="button"
                          onClick={() => setConfirmingId(expense.id)}
                          title="Deshacer esta salida"
                          aria-label={`Deshacer salida: ${expense.reason}`}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors outline-none focus-visible:ring-[1px] focus-visible:ring-ring"
                        >
                          <Undo2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer Summary */}
        <div className="p-5 border-t border-border shrink-0">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="space-y-0.5 min-w-0">
              <span className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total Retiros</span>
              <p className="text-xs text-muted-foreground">Suma total de este listado</p>
            </div>
            <span className="text-xl font-semibold tracking-tight text-destructive font-mono tabular-nums truncate" title={formatCurrency(totalExpenses)}>
              {formatCurrency(totalExpenses)}
            </span>
          </div>
          <Button
            className="w-full h-11"
            variant="outline"
            onClick={onClose}
          >
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
