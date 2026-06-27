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
        <div className="p-6 pb-4 space-y-1 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-destructive">
              <LayoutList className="h-5 w-5" />
              <h2 className="text-xl font-semibold tracking-tight">{title || 'Salidas de Efectivo'}</h2>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Listado detallado de retiros realizados {title ? 'en este turno' : 'en el turno actual'}
          </p>
        </div>
        
        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 py-2">
          {displayExpenses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                <ReceiptPoundSterling className="h-8 w-8 text-muted-foreground/30" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No hay salidas registradas</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {[...displayExpenses].reverse().map((expense, idx) => (
                <div 
                  key={idx} 
                  className="py-4 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-bold text-muted-foreground/50 tabular-nums">
                        {formatTime(expense.created_at)}
                      </span>
                      <span className="h-1 w-1 rounded-full bg-border" />
                      <p className="text-sm font-medium text-foreground truncate">
                        {expense.reason}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-bold text-destructive tabular-nums tracking-tight">
                      -{formatCurrency(expense.amount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Summary */}
        <div className="p-6 bg-muted/5 border-t">
          <div className="flex items-center justify-between mb-4">
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Total Retiros</span>
              <p className="text-xs text-muted-foreground/60">Suma total de este listado</p>
            </div>
            <span className="text-2xl font-black text-destructive tabular-nums tracking-tighter">
              {formatCurrency(totalExpenses)}
            </span>
          </div>
          <Button 
            className="w-full h-11 font-semibold shadow-sm" 
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
