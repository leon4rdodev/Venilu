import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { HandCoins, CheckCircle2, Banknote, ArrowLeftRight, AlertTriangle, Loader2 } from "lucide-react";
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

type PaymentMethod = 'cash' | 'transfer';

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: 'cash', label: 'Efectivo', icon: Banknote },
  { value: 'transfer', label: 'Transferencia', icon: ArrowLeftRight },
];

export function PayDebtDialog({ open, onOpenChange, customer, shiftId, onSuccess }: PayDebtDialogProps) {
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [newBalance, setNewBalance] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Foco explícito (sin autoFocus): al abrir va al monto; al confirmar, el
  // input se desmonta y el foco pasaría al body — lo movemos al botón Cerrar.
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      if (showSuccess) closeRef.current?.focus();
      else inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, [open, showSuccess]);

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
  const exceedsBalance = parsedAmount > balance;
  // Must have an active shift so the payment is tied to a cash reconciliation period.
  // A payment without shiftId is orphaned and never shows in the close-shift balance.
  const isValid = parsedAmount > 0 && !exceedsBalance && !!shiftId;

  const handlePayFull = () => {
    setAmount(balance.toFixed(2));
    inputRef.current?.focus();
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setIsLoading(false);
    }
  };

  if (!customer) return null;

  const amountDescribedBy = [
    exceedsBalance ? "pay-debt-amount-error" : null,
    parsedAmount > 0 && !exceedsBalance ? "pay-debt-remaining" : null,
  ].filter(Boolean).join(" ") || undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden" aria-busy={isLoading || undefined}>
        {!showSuccess ? (
          <>
            {/* Header */}
            <div className="p-6 pb-4 pr-12 border-b border-border space-y-1">
              <DialogTitle className="text-lg font-semibold tracking-tight">Abonar a Deuda</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground truncate" title={customer.name}>
                {customer.name}
              </DialogDescription>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              {/* Balance */}
              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-3 px-3.5 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Deuda actual</span>
                  <span className="text-xl font-semibold tracking-tight font-mono tabular-nums text-amber-700 dark:text-amber-400">
                    {formatCurrency(balance)}
                  </span>
                </div>

                {/* No-shift warning — payment without a shift is orphaned and skews cash balance */}
                {!shiftId && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 px-3.5 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" strokeWidth={1.75} aria-hidden="true" />
                    <span>
                      No tienes un turno activo. Abre un turno en el POS primero para que este abono
                      quede registrado en el balance de caja.
                    </span>
                  </div>
                )}
              </div>

              {/* Payment Method — radiogroup: teclado y lector de pantalla entienden la elección */}
              <div className="space-y-2">
                <div
                  id="pay-debt-method-label"
                  className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider"
                >
                  <ArrowLeftRight className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                  Método de Pago
                </div>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby="pay-debt-method-label">
                  {PAYMENT_METHODS.map(({ value, label, icon: Icon }) => {
                    const selected = paymentMethod === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setPaymentMethod(value)}
                        disabled={isLoading}
                        className={cn(
                          "flex items-center justify-center gap-2 h-10 rounded-lg border text-sm font-medium transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                          "disabled:opacity-50 disabled:pointer-events-none",
                          selected
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-foreground border-border hover:bg-muted"
                        )}
                      >
                        <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="pay-debt-amount"
                    className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider"
                  >
                    <HandCoins className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                    Monto a Abonar
                  </Label>
                  <button
                    type="button"
                    onClick={handlePayFull}
                    disabled={isLoading || balance <= 0}
                    className="text-xs font-semibold text-foreground hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none"
                    aria-label={`Pagar todo: ${formatCurrency(balance)}`}
                  >
                    Pagar todo
                  </button>
                </div>
                <div className="relative">
                  <div
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-medium text-muted-foreground pointer-events-none select-none"
                    aria-hidden="true"
                  >
                    {getCurrencySymbol()}
                  </div>
                  <Input
                    ref={inputRef}
                    id="pay-debt-amount"
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
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && isValid && !isLoading) {
                        e.preventDefault();
                        handleConfirm();
                      }
                    }}
                    className="h-12 text-right font-semibold tabular-nums pl-18 pr-5 text-xl!"
                    disabled={isLoading}
                    autoComplete="off"
                    aria-invalid={exceedsBalance || undefined}
                    aria-describedby={amountDescribedBy}
                  />
                </div>

                {parsedAmount > 0 && !exceedsBalance && (
                  <div
                    id="pay-debt-remaining"
                    className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-lg bg-muted/30 border border-border"
                  >
                    <span className="text-sm text-muted-foreground">Deuda restante</span>
                    <span className="text-sm font-mono font-semibold tabular-nums">
                      {formatCurrency(balance - parsedAmount)}
                    </span>
                  </div>
                )}

                {exceedsBalance && (
                  <p id="pay-debt-amount-error" role="alert" className="text-xs text-destructive">
                    El monto excede la deuda pendiente ({formatCurrency(balance)}).
                  </p>
                )}
              </div>

              {/* Error */}
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 px-3.5 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-destructive" strokeWidth={1.75} aria-hidden="true" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 pt-4 border-t border-border flex gap-3">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
                className="flex-1 h-10"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isLoading || !isValid}
                className="flex-1 h-10"
              >
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />Procesando…</>
                ) : (
                  <><HandCoins className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />Registrar Abono</>
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Success */}
            <div className="p-6 pb-4 pr-12 border-b border-border space-y-1">
              <DialogTitle className="text-lg font-semibold tracking-tight">Abono Registrado</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">El pago se registró exitosamente</DialogDescription>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex flex-col items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center" aria-hidden="true">
                  <CheckCircle2 className="h-7 w-7 text-emerald-700 dark:text-emerald-400" strokeWidth={1.75} />
                </div>
                <dl className="w-full rounded-lg border border-border divide-y divide-border text-sm">
                  <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <dt className="text-muted-foreground">Cliente</dt>
                    <dd className="font-medium truncate" title={customer.name}>{customer.name}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <dt className="text-muted-foreground">Monto abonado</dt>
                    <dd className="font-mono font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {formatCurrency(parsedAmount)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-muted/40">
                    <dt className="font-medium">Deuda restante</dt>
                    <dd className="font-mono font-semibold tabular-nums">
                      {formatCurrency(newBalance)}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
            <div className="p-6 pt-4 border-t border-border flex gap-3">
              <Button ref={closeRef} onClick={() => onOpenChange(false)} className="w-full h-10">
                Cerrar
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
