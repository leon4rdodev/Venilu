import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { HandCoins, CheckCircle2, Banknote, ArrowLeftRight } from "lucide-react";
import { formatCurrency, getCurrencySymbol } from "@lib/currency";
import { Customer, DebtPayment } from "@shared/types/models";
import { ipc } from "@lib/ipc";
import { toast } from "sonner";
import { cn } from "@lib/utils";

interface PayDebtDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: Customer | null;
  shiftId?: string;
  onSuccess: (payment?: DebtPayment) => void;
}

export function PayDebtDialog({ open, onOpenChange, customer, shiftId, onSuccess }: PayDebtDialogProps) {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [newBalance, setNewBalance] = useState(0);

  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setAmount("");
        setPaymentMethod('cash');
        setError(null);
        setIsLoading(false);
        setShowSuccess(false);
        setNewBalance(0);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const balance = Number(customer?.balance || 0);
  const parsedAmount = parseFloat(amount) || 0;
  // Must have an active shift so the payment is tied to a cash reconciliation period.
  // A payment without shiftId is orphaned and never shows in the close-shift balance.
  const isValid = parsedAmount > 0 && parsedAmount <= balance && !!shiftId;

  const handlePayFull = () => {
    setAmount(balance.toFixed(2));
  };

  const handleConfirm = async () => {
    if (!customer || !isValid) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = (await ipc.invoke("pay-customer-debt", {
        customerId: customer.id,
        amount: parsedAmount,
        shiftId,
        paymentMethod,
      })) as { success: boolean; data?: { newBalance: number; payment: DebtPayment }; message?: string };

      if (result.success) {
        setNewBalance(result.data?.newBalance || 0);
        setShowSuccess(true);
        toast.success("Abono registrado", {
          description: `Se abonaron ${formatCurrency(parsedAmount)} a la deuda de ${customer.name}`,
        });
        onSuccess(result.data?.payment);
      } else {
        setError(result.message || "Error al registrar el abono");
      }
    } catch (err: any) {
      setError(err.message || "Error inesperado");
    } finally {
      setIsLoading(false);
    }
  };

  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden">
        {!showSuccess ? (
          <>
            {/* Header */}
            <div className="p-5 pb-3 space-y-1 border-b">
              <h2 className="text-xl font-semibold tracking-tight">Abonar a Deuda</h2>
              <p className="text-sm text-muted-foreground">{customer.name}</p>
            </div>

            {/* Balance */}
            <div className="px-5 pt-4 pb-3">
              <div className="flex items-baseline justify-between px-3.5 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <span className="text-sm text-amber-700 dark:text-amber-400">Deuda actual</span>
                <span className="text-2xl font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                  {formatCurrency(balance)}
                </span>
              </div>

              {/* No-shift warning — payment without a shift is orphaned and skews cash balance */}
              {!shiftId && (
                <div className="mt-2 flex items-start gap-2 px-3.5 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  <span className="shrink-0 mt-0.5">⚠</span>
                  <span>
                    No tienes un turno activo. Abre un turno en el POS primero para que este abono
                    quede registrado en el balance de caja.
                  </span>
                </div>
              )}
            </div>

            {/* Payment Method Toggle */}
            <div className="px-5 pb-3 space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                <ArrowLeftRight className="h-3 w-3" />
                Método de Pago
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={cn(
                    "flex items-center justify-center gap-2 h-10 rounded-lg border text-sm font-medium transition-colors",
                    paymentMethod === 'cash'
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted"
                  )}
                >
                  <Banknote className="h-4 w-4" />
                  Efectivo
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('transfer')}
                  className={cn(
                    "flex items-center justify-center gap-2 h-10 rounded-lg border text-sm font-medium transition-colors",
                    paymentMethod === 'transfer'
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted"
                  )}
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  Transferencia
                </button>
              </div>
            </div>

            {/* Amount */}
            <div className="px-5 pb-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  <HandCoins className="h-3 w-3" />
                  Monto a Abonar
                </div>
                <button
                  onClick={handlePayFull}
                  className="text-[10px] font-semibold text-primary hover:underline"
                >
                  Pagar todo
                </button>
              </div>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground pointer-events-none">
                  {getCurrencySymbol()}
                </div>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
                      setAmount(value);
                    }
                  }}
                  className="h-12 text-lg! text-right font-bold pl-18 pr-5"
                  style={{ fontSize: "1.25rem" }}
                  autoFocus
                  disabled={isLoading}
                />
              </div>

              {parsedAmount > 0 && parsedAmount <= balance && (
                <div className="flex items-center justify-between px-3.5 py-2 rounded-lg bg-muted/30 border">
                  <span className="text-sm text-muted-foreground">Deuda restante</span>
                  <span className="text-sm font-semibold tabular-nums">
                    {formatCurrency(balance - parsedAmount)}
                  </span>
                </div>
              )}

              {parsedAmount > balance && (
                <p className="text-xs text-destructive text-center">
                  El monto excede la deuda pendiente
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="px-5 pb-3">
                <div className="px-3.5 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive text-center">{error}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="p-5 pt-3 border-t flex gap-3">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
                className="flex-1 h-11"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isLoading || !isValid}
                className="flex-1 h-11"
              >
                {isLoading ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <><HandCoins className="h-4 w-4" />Registrar Abono</>
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Success */}
            <div className="p-5 pb-3 space-y-1 border-b">
              <h2 className="text-xl font-semibold tracking-tight">Abono Registrado</h2>
              <p className="text-sm text-muted-foreground">El pago se registró exitosamente</p>
            </div>
            <div className="px-5 py-6">
              <div className="flex flex-col items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-7 w-7 text-green-600 dark:text-green-400" />
                </div>
                <div className="w-full rounded-lg border divide-y text-sm">
                  <div className="flex items-center justify-between px-3.5 py-2.5">
                    <span className="text-muted-foreground">Cliente</span>
                    <span className="font-medium">{customer.name}</span>
                  </div>
                  <div className="flex items-center justify-between px-3.5 py-2.5">
                    <span className="text-muted-foreground">Monto abonado</span>
                    <span className="font-bold text-green-700 dark:text-green-400 tabular-nums">
                      {formatCurrency(parsedAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3.5 py-2.5 bg-muted/40">
                    <span className="font-medium">Deuda restante</span>
                    <span className="font-bold tabular-nums">
                      {formatCurrency(newBalance)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-5 pt-3 border-t">
              <Button onClick={() => onOpenChange(false)} className="w-full h-11">
                Cerrar
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
