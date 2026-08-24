import { Dialog, DialogContent } from '@components/ui/dialog';
import { Button } from '@components/ui/button';
import { formatCurrency } from '@lib/currency';
import { formatTime } from '@lib/formatters';
import { ReceiptPoundSterling, LayoutList } from 'lucide-react';
import { useShift } from '../hooks/use-shift';

interface ViewExpensesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  expenses?: any[];
  title?: string;
}

export function ViewExpensesDialog({ isOpen, onClose, expenses, title }: ViewExpensesDialogProps) {
  const { shiftExpenses: currentShiftExpenses } = useShift();

  const displayExpenses = expenses || currentShiftExpenses;
  const totalExpenses = displayExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-5 pb-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
              <LayoutList className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">{title || 'Salidas de Efectivo'}</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1 ml-[42px]">
            Listado detallado de retiros realizados {title ? 'en este turno' : 'en el turno actual'}
          </p>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-1">
          {displayExpenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                <ReceiptPoundSterling className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No hay salidas registradas</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {[...displayExpenses].reverse().map((expense, idx) => (
                <div
                  key={idx}
                  className="py-3 flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {expense.reason}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatTime(expense.created_at)}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-destructive font-mono tabular-nums shrink-0">
                    -{formatCurrency(expense.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Summary */}
        <div className="p-5 border-t border-border shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-0.5">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total Retiros</span>
              <p className="text-xs text-muted-foreground">Suma total de este listado</p>
            </div>
            <span className="text-xl font-semibold tracking-tight text-destructive font-mono tabular-nums">
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
