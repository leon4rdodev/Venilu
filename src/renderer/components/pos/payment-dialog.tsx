import { useState, useEffect } from "react"
import { Dialog, DialogContent } from "@components/ui/dialog"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { CreditCard, Banknote, ArrowRightLeft, Printer, CheckCircle2 } from "lucide-react"
import { formatCurrency } from "@lib/currency"
import { cn } from "@lib/utils"
import { toast } from "sonner"
import { PaymentMethod } from "@shared/types/models"

type PaymentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  total: number
  onComplete: (paymentMethod: PaymentMethod, amountPaid: number, changeGiven: number) => Promise<{ success: boolean, saleId?: string, message?: string }>
}

export function PaymentDialog({ open, onOpenChange, total, onComplete }: PaymentDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash")
  const [amountReceived, setAmountReceived] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [saleId, setSaleId] = useState<string | undefined>(undefined)
  const [isPrinting, setIsPrinting] = useState(false)

  const [confirmedDetails, setConfirmedDetails] = useState<{
    total: number
    paymentMethod: PaymentMethod
    change: number
  } | null>(null)

  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setShowSuccess(false)
        setError(null)
        setIsLoading(false)
        setAmountReceived("")
        setPaymentMethod("cash")
        setSaleId(undefined)
        setIsPrinting(false)
        setConfirmedDetails(null)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [open])

  const parseAmount = (value: string): number => {
    const parsed = Number.parseFloat(value)
    return isNaN(parsed) ? 0 : parsed
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setAmountReceived(value)
    }
  }

  const amountPaid = parseAmount(amountReceived)
  const change = paymentMethod === "cash" ? Math.max(0, amountPaid - total) : 0
  const isValidPayment = paymentMethod === "card" || paymentMethod === "transfer" || (amountReceived && amountPaid >= total)

  const handleConfirm = async () => {
    setIsLoading(true)
    setError(null)

    // Capture details before processing
    const currentDetails = {
      total,
      paymentMethod,
      change
    }

    try {
      const result = await onComplete(
        paymentMethod,
        paymentMethod === "cash" ? amountPaid : total,
        change
      )

      if (result.success) {
        setConfirmedDetails(currentDetails)
        setSaleId(result.saleId)
        setShowSuccess(true)
      } else {
        setError(result.message || "Error al procesar la venta")
      }
    } catch (err: any) {
      setError(err.message || "Ocurrió un error inesperado")
    } finally {
      setIsLoading(false)
    }
  }

  const handlePrintTicket = async () => {
    if (!saleId || !window.ipcRenderer) {
      toast.error("Error al imprimir", {
        description: "Sistema de impresión no disponible"
      })
      return
    }

    try {
      setIsPrinting(true)
      const result = await window.ipcRenderer.invoke("print-receipt", { saleId }) as {
        success: boolean
        message?: string
      }

      if (result.success) {
        toast.success("Ticket impreso correctamente")
      } else {
        toast.error("Error al imprimir", {
          description: result.message || "No se pudo imprimir el ticket"
        })
      }
    } catch (error) {
      toast.error("Error al imprimir")
    } finally {
      setIsPrinting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-sm p-0 gap-0 overflow-hidden"
        onPointerDownOutside={(e) => showSuccess && e.preventDefault()}
        onEscapeKeyDown={(e) => showSuccess && e.preventDefault()}
      >
        {!showSuccess ? (
          <>
            {/* Header */}
            <div className="p-5 pb-3 space-y-1 border-b">
              <h2 className="text-xl font-semibold tracking-tight">Procesar Pago</h2>
              <p className="text-sm text-muted-foreground">
                Selecciona el método y confirma el cobro
              </p>
            </div>

            {/* Total */}
            <div className="px-5 pt-4 pb-3">
              <div className="flex items-baseline justify-between px-3.5 py-2.5 rounded-lg bg-muted/40 border">
                <span className="text-sm text-muted-foreground">Total a cobrar</span>
                <span className="text-2xl font-bold tracking-tight tabular-nums">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Payment Method */}
            <div className="px-5 pb-3 space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                <CreditCard className="h-3 w-3" />
                Método de Pago
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: "cash", label: "Efectivo", icon: Banknote, bgActive: "bg-green-500/10", textActive: "text-green-600 dark:text-green-400" },
                  { id: "card", label: "Tarjeta", icon: CreditCard, bgActive: "bg-blue-500/10", textActive: "text-blue-600 dark:text-blue-400" },
                  { id: "transfer", label: "Transfer.", icon: ArrowRightLeft, bgActive: "bg-purple-500/10", textActive: "text-purple-600 dark:text-purple-400" },
                ] as const).map((method) => {
                  const isSelected = paymentMethod === method.id
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setPaymentMethod(method.id)}
                      disabled={isLoading}
                      className={cn(
                        "flex flex-col items-center gap-2 p-3 rounded-lg border transition-all",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-border/80 hover:bg-muted/30"
                      )}
                    >
                      <div className={cn(
                        "p-2 rounded-md",
                        isSelected ? method.bgActive : "bg-muted/50"
                      )}>
                        <method.icon className={cn(
                          "h-4 w-4",
                          isSelected ? method.textActive : "text-muted-foreground"
                        )} />
                      </div>
                      <span className="text-xs font-medium">{method.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Cash Input */}
            {paymentMethod === "cash" && (
              <div className="px-5 pb-3 space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  <Banknote className="h-3 w-3" />
                  Monto Recibido
                </div>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground pointer-events-none">
                    RD$
                  </div>
                  <Input
                    id="amount"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amountReceived}
                    onChange={handleAmountChange}
                    className="h-12 !text-lg text-right font-bold pl-18 pr-5"
                    style={{ fontSize: '1.25rem' }}
                    autoFocus
                    disabled={isLoading}
                  />
                </div>

                {/* Change indicator */}
                {amountReceived && amountPaid >= total && (
                  <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-green-500/10 border border-green-500/20">
                    <span className="text-sm font-medium text-green-700 dark:text-green-400">Cambio</span>
                    <span className="text-lg font-bold text-green-700 dark:text-green-400 tabular-nums">
                      {formatCurrency(change)}
                    </span>
                  </div>
                )}
              </div>
            )}

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
                disabled={isLoading || !isValidPayment}
                className="flex-1 h-11"
              >
                {isLoading ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Procesando...
                  </>
                ) : (
                  'Confirmar Pago'
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Success Header */}
            <div className="p-5 pb-3 space-y-1 border-b">
              <h2 className="text-xl font-semibold tracking-tight">Venta Completada</h2>
              <p className="text-sm text-muted-foreground">
                La transacción se procesó exitosamente
              </p>
            </div>

            {/* Success Content */}
            <div className="px-5 py-6">
              <div className="flex flex-col items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-7 w-7 text-green-600 dark:text-green-400" />
                </div>

                {/* Sale summary */}
                <div className="w-full rounded-lg border divide-y text-sm">
                  {saleId && (
                    <div className="flex items-center justify-between px-3.5 py-2.5">
                      <span className="text-muted-foreground">Venta #</span>
                      <span className="font-bold tabular-nums">{saleId}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between px-3.5 py-2.5">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-bold tabular-nums">
                      {formatCurrency(confirmedDetails?.total || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-3.5 py-2.5">
                    <span className="text-muted-foreground">Método</span>
                    <div className="flex items-center gap-1.5">
                      {(confirmedDetails?.paymentMethod || paymentMethod) === "cash" ? (
                        <Banknote className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                      ) : (confirmedDetails?.paymentMethod || paymentMethod) === "transfer" ? (
                        <ArrowRightLeft className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                      ) : (
                        <CreditCard className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      )}
                      <span className="font-medium">
                        {(confirmedDetails?.paymentMethod || paymentMethod) === "cash" ? "Efectivo" : 
                         (confirmedDetails?.paymentMethod || paymentMethod) === "transfer" ? "Transferencia" : "Tarjeta"}
                      </span>
                    </div>
                  </div>
                  {(confirmedDetails?.paymentMethod || paymentMethod) === "cash" && (confirmedDetails?.change || change) > 0 && (
                    <div className="flex items-center justify-between px-3.5 py-2.5 bg-green-500/5">
                      <span className="text-green-700 dark:text-green-400">Cambio</span>
                      <span className="font-bold text-green-700 dark:text-green-400 tabular-nums">
                        {formatCurrency(confirmedDetails?.change || change)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-5 pt-3 border-t space-y-2">
              <div className="flex gap-3">
                <Button
                  onClick={handlePrintTicket}
                  disabled={isPrinting || !saleId}
                  variant="outline"
                  className="flex-1 h-11"
                >
                  {isPrinting ? (
                    <>
                      <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      Imprimiendo...
                    </>
                  ) : (
                    <>
                      <Printer className="h-4 w-4" />
                      Imprimir Ticket
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => onOpenChange(false)}
                  disabled={isPrinting}
                  className="flex-1 h-11"
                >
                  Cerrar
                </Button>
              </div>
              <p className="text-[11px] text-center text-muted-foreground">
                Puedes reimprimir desde el historial de ventas
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}