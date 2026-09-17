import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { HandCoins, CheckCircle2, Banknote, ArrowLeftRight, AlertCircle } from "lucide-react";
import { formatCurrency, getCurrencySymbol } from "@lib/currency";
import { Supplier, SupplierPayment } from "@shared/types/models";
import { ipc } from "@lib/ipc";
import { toast } from "sonner";
import { cn } from "@lib/utils";

interface PaySupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier: Supplier | null;
  /** Turno abierto del usuario — obligatorio solo para pagos en efectivo */
  shiftId?: string;
  onSuccess: (payment?: SupplierPayment) => void;
}

/** Pago (abono) a la cuenta por pagar de un suplidor. */
export function PaySupplierDialog({ open, onOpenChange, supplier, shiftId, onSuccess }: PaySupplierDialogProps) {
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "transfer">("cash");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [newBalance, setNewBalance] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && !showSuccess) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open, showSuccess]);

  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setAmount(""); setNotes(""); setPaymentMethod("cash"); setError(null);
        setIsLoading(false); setShowSuccess(false); setNewBalance(0);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const balance = Number(supplier?.balance || 0);
  const parsedAmount = parseFloat(amount) || 0;
  const needsShift = paymentMethod === "cash" && !shiftId;
  const isValid = parsedAmount > 0 && parsedAmount <= balance && !needsShift;

  const handleConfirm = async () => {
    if (!supplier || !isValid) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = (await ipc.invoke("suppliers:pay", {
        supplierId: supplier.id, amount: parsedAmount, paymentMethod, notes: notes.trim() || undefined,
      })) as { success: boolean; data?: { newBalance: number; payment: SupplierPayment }; message?: string };
      if (result.success) {
        setNewBalance(result.data?.newBalance || 0);
        setShowSuccess(true);
        toast.success("Pago registrado", { description: `Se pagaron ${formatCurrency(parsedAmount)} a ${supplier.name}` });
        onSuccess(result.data?.payment);
      } else {
        setError(result.message || "Error al registrar el pago");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setIsLoading(false);
    }
  };

  if (!supplier) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden">
        {!showSuccess ? (
          <>
            <div className="p-6 pb-4 border-b border-border space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center shrink-0">
                  <HandCoins className="h-4 w-4" strokeWidth={1.75} />
                </div>
                <DialogTitle className="text-lg font-semibold tracking-tight">Pagar a Suplidor</DialogTitle>
              </div>
              <DialogDescription className="text-sm text-muted-foreground truncate" title={supplier.name}>{supplier.name}</DialogDescription>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-baseline justify-between px-3.5 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <span className="text-sm text-amber-600 dark:text-amber-400">Cuenta por pagar</span>
                <span className="text-xl font-semibold tracking-tight font-mono tabular-nums text-amber-600 dark:text-amber-400">{formatCurrency(balance)}</span>
              </div>

              <div className="space-y-2">
                <div id="pay-supplier-method-label" className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  <ArrowLeftRight className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                  Método de Pago
                </div>
                <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="pay-supplier-method-label">
                  {([["cash", "Efectivo", Banknote], ["transfer", "Transferencia", ArrowLeftRight]] as const).map(([id, label, Icon]) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={paymentMethod === id}
                      onClick={() => setPaymentMethod(id)}
                      className={cn(
                        "flex items-center justify-center gap-2 h-10 rounded-lg border text-sm font-medium transition-colors",
                        paymentMethod === id ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted",
                      )}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.75} />
                      {label}
                    </button>
                  ))}
                </div>
                {needsShift && (
                  <div role="alert" className="flex items-start gap-2 px-3.5 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    <span>El efectivo sale de tu caja: abre un turno en el POS o paga por transferencia.</span>
                  </div>
                )}
                {paymentMethod === "cash" && shiftId && (
                  <p className="text-xs text-muted-foreground">Se registrará como salida de caja de tu turno.</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="pay-supplier-amount" className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                    <HandCoins className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                    Monto a Pagar
                  </label>
                  <button type="button" onClick={() => setAmount(balance.toFixed(2))} disabled={isLoading} className="text-xs font-semibold text-foreground hover:underline rounded-sm disabled:opacity-50">
                    Pagar todo
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-medium text-muted-foreground pointer-events-none">{getCurrencySymbol()}</div>
                  <Input
                    id="pay-supplier-amount"
                    ref={inputRef}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0.00"
                    aria-invalid={parsedAmount > balance || undefined}
                    aria-describedby={parsedAmount > balance ? "pay-supplier-amount-error" : undefined}
                    value={amount}
                    onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) setAmount(v); }}
                    className="h-12 text-lg! text-right font-semibold tabular-nums pl-18 pr-5"
                    style={{ fontSize: "1.25rem" }}
                    disabled={isLoading}
                  />
                </div>
                {parsedAmount > 0 && parsedAmount <= balance && (
                  <div className="flex items-center justify-between px-3.5 py-2 rounded-lg bg-muted/30 border border-border">
                    <span className="text-sm text-muted-foreground">Quedará pendiente</span>
                    <span className="text-sm font-mono font-semibold tabular-nums">{formatCurrency(balance - parsedAmount)}</span>
                  </div>
                )}
                {parsedAmount > balance && <p id="pay-supplier-amount-error" role="alert" className="text-xs text-destructive px-1">El monto excede la cuenta por pagar ({formatCurrency(balance)}).</p>}
              </div>

              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Referencia o nota (opcional)" aria-label="Referencia o nota" className="h-9 text-sm" disabled={isLoading} />

              {error && (
                <div role="alert" className="px-3.5 py-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive text-center">{error}</p>
                </div>
              )}
            </div>
            <div className="p-6 pt-4 border-t border-border flex gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading} className="flex-1 h-10">Cancelar</Button>
              <Button onClick={handleConfirm} disabled={isLoading || !isValid} className="flex-1 h-10" aria-busy={isLoading}>
                {isLoading ? "Procesando..." : (<><HandCoins className="h-4 w-4" strokeWidth={1.75} />Registrar Pago</>)}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="p-6 pb-4 border-b border-border space-y-1">
              <DialogTitle className="text-lg font-semibold tracking-tight">Pago Registrado</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">El pago al suplidor quedó registrado</DialogDescription>
            </div>
            <div className="p-6">
              <div className="flex flex-col items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center" aria-hidden="true">
                  <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
                </div>
                <div className="w-full rounded-lg border border-border divide-y divide-border text-sm">
                  <div className="flex items-center justify-between gap-3 px-3.5 py-2.5"><span className="text-muted-foreground shrink-0">Suplidor</span><span className="font-medium truncate" title={supplier.name}>{supplier.name}</span></div>
                  <div className="flex items-center justify-between px-3.5 py-2.5"><span className="text-muted-foreground">Monto pagado</span><span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(parsedAmount)}</span></div>
                  <div className="flex items-center justify-between px-3.5 py-2.5 bg-muted/40"><span className="font-medium">Pendiente</span><span className="font-mono font-semibold tabular-nums">{formatCurrency(newBalance)}</span></div>
                </div>
              </div>
            </div>
            <div className="p-6 pt-4 border-t border-border">
              <Button onClick={() => onOpenChange(false)} className="w-full h-10">Cerrar</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
