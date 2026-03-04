import { useState, useEffect, useRef, useCallback } from "react"
import { Dialog, DialogContent } from "@components/ui/dialog"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { CreditCard, Banknote, ArrowRightLeft, Printer, CheckCircle2, HandCoins, User2, Search, X, AlertCircle } from "lucide-react"
import { formatCurrency, getCurrencySymbol } from "@lib/currency"
import { cn } from "@lib/utils"
import { toast } from "sonner"
import { PaymentMethod, Customer } from "@shared/types/models"
import { ipc } from "@lib/ipc"

type PaymentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  subtotal: number
  discountAmount: number
  total: number
  selectedCustomer: Customer | null
  onSelectCustomer: (customer: Customer | null) => void
  onComplete: (paymentMethod: PaymentMethod, amountPaid: number, changeGiven: number) => Promise<{ success: boolean, saleId?: string, message?: string }>
}

// Inline customer selector for the payment dialog
function InlineCustomerSelector({ selectedCustomer, onSelectCustomer }: { selectedCustomer: Customer | null, onSelectCustomer: (c: Customer | null) => void }) {
  const [showSearch, setShowSearch] = useState(false)
  const [search, setSearch] = useState("")
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const fetchCustomers = useCallback(async (query: string = "") => {
    setLoading(true)
    try {
      const channel = query.trim() ? "search-customers" : "get-customers"
      const args = query.trim() ? query.trim() : undefined
      const result = (await ipc.invoke(channel, args)) as { success: boolean; data?: Customer[] }
      if (result.success && result.data) setCustomers(result.data)
    } catch (error) {
      console.error("Error fetching customers:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (showSearch) {
      fetchCustomers()
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [showSearch, fetchCustomers])

  useEffect(() => {
    if (!showSearch) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchCustomers(search), 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [search, showSearch, fetchCustomers])

  if (selectedCustomer) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-primary/5 border-primary/20">
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <User2 className="h-4.5 w-4.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{selectedCustomer.name}</p>
          {Number(selectedCustomer.balance) > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Deuda pendiente: {formatCurrency(Number(selectedCustomer.balance))}
            </p>
          )}
          {selectedCustomer.phone && Number(selectedCustomer.balance) <= 0 && (
            <p className="text-xs text-muted-foreground">{selectedCustomer.phone}</p>
          )}
        </div>
        <button
          onClick={() => { onSelectCustomer(null); setShowSearch(false); setSearch("") }}
          className="p-1.5 rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  if (showSearch) {
    return (
      <div className="rounded-xl border overflow-hidden">
        <div className="p-2.5 border-b bg-muted/20">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o teléfono..."
              className="h-9 pl-9 text-sm"
            />
          </div>
        </div>
        <div className="max-h-36 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-5">
              <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-5 text-sm text-muted-foreground">
              {search ? "No se encontraron clientes" : "No hay clientes registrados"}
            </div>
          ) : (
            customers.map((c) => (
              <button
                key={c.id}
                onClick={() => { onSelectCustomer(c); setShowSearch(false); setSearch("") }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-muted/50 transition-colors border-b last:border-b-0 border-border/30"
              >
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <User2 className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  {c.phone && <p className="text-xs text-muted-foreground">{c.phone}</p>}
                </div>
                {Number(c.balance) > 0 && (
                  <span className="text-xs font-medium text-amber-600 dark:text-amber-400 whitespace-nowrap">
                    {formatCurrency(Number(c.balance))}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
        <div className="p-2 border-t">
          <button onClick={() => { setShowSearch(false); setSearch("") }} className="w-full text-xs text-muted-foreground hover:text-foreground text-center py-1">
            Cancelar búsqueda
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowSearch(true)}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-border/80 hover:border-primary/40 hover:bg-muted/20 transition-all text-left"
    >
      <div className="h-9 w-9 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
        <User2 className="h-4.5 w-4.5 text-muted-foreground" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-muted-foreground">Sin cliente asignado</p>
        <p className="text-xs text-muted-foreground/70">Toca para buscar y asignar un cliente</p>
      </div>
    </button>
  )
}

export function PaymentDialog({ open, onOpenChange, subtotal, discountAmount, total, selectedCustomer, onSelectCustomer, onComplete }: PaymentDialogProps) {
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
    isCredit: boolean
    customerName?: string
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
  const isCredit = paymentMethod === "credit"
  const isValidPayment = isCredit
    || paymentMethod === "card"
    || paymentMethod === "transfer"
    || (amountReceived && amountPaid >= total)

  const handleConfirm = async () => {
    setIsLoading(true)
    setError(null)

    const currentDetails = {
      total,
      paymentMethod,
      change,
      isCredit,
      customerName: selectedCustomer?.name,
    }

    try {
      const result = await onComplete(
        paymentMethod,
        isCredit ? 0 : (paymentMethod === "cash" ? amountPaid : total),
        isCredit ? 0 : change
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
      toast.error("Error al imprimir", { description: "Sistema de impresión no disponible" })
      return
    }

    try {
      setIsPrinting(true)
      const result = await window.ipcRenderer.invoke("print-receipt", { saleId }) as { success: boolean; message?: string }

      if (result.success) {
        toast.success("Ticket impreso correctamente")
      } else {
        toast.error("Error al imprimir", { description: result.message || "No se pudo imprimir el ticket" })
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
        className="sm:max-w-md p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col"
        onPointerDownOutside={(e) => showSuccess && e.preventDefault()}
        onEscapeKeyDown={(e) => showSuccess && e.preventDefault()}
      >
        {!showSuccess ? (
          <>
            {/* Header */}
            <div className="p-6 pb-4 space-y-1.5 border-b shrink-0">
              <h2 className="text-2xl font-bold tracking-tight">Procesar Pago</h2>
              <p className="text-sm text-muted-foreground">
                Selecciona el cliente, método de pago y confirma
              </p>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
              {/* Customer selector */}
              <div className="px-6 pt-5 pb-3 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <User2 className="h-3.5 w-3.5" />
                  Cliente
                </div>
                <InlineCustomerSelector
                  selectedCustomer={selectedCustomer}
                  onSelectCustomer={onSelectCustomer}
                />
              </div>

              {/* Total Section */}
              <div className="px-6 pt-2 pb-3 space-y-2">
                {discountAmount > 0 && (
                  <>
                    <div className="flex items-baseline justify-between px-4 py-2 rounded-xl bg-muted/20">
                      <span className="text-sm text-muted-foreground">Subtotal</span>
                      <span className="text-sm font-semibold tabular-nums">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex items-baseline justify-between px-4 py-2 rounded-xl bg-red-500/5 border border-red-500/10">
                      <span className="text-sm text-red-600 dark:text-red-400">Descuento</span>
                      <span className="text-sm font-semibold text-red-600 dark:text-red-400 tabular-nums">-{formatCurrency(discountAmount)}</span>
                    </div>
                  </>
                )}
                <div className="flex items-baseline justify-between px-4 py-3 rounded-xl bg-muted/40 border">
                  <span className="text-base text-muted-foreground font-medium">Total a cobrar</span>
                  <span className="text-3xl font-bold tracking-tight tabular-nums">{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Payment Method */}
              <div className="px-6 pb-4 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <CreditCard className="h-3.5 w-3.5" />
                  Método de Pago
                </div>
                <div className="grid grid-cols-4 gap-2.5">
                  {([
                    { id: "cash", label: "Efectivo", icon: Banknote, bgActive: "bg-green-500/10", textActive: "text-green-600 dark:text-green-400" },
                    { id: "card", label: "Tarjeta", icon: CreditCard, bgActive: "bg-blue-500/10", textActive: "text-blue-600 dark:text-blue-400" },
                    { id: "transfer", label: "Transfer.", icon: ArrowRightLeft, bgActive: "bg-purple-500/10", textActive: "text-purple-600 dark:text-purple-400" },
                    { id: "credit", label: "Fiado", icon: HandCoins, bgActive: "bg-amber-500/10", textActive: "text-amber-600 dark:text-amber-400", requiresCustomer: true },
                  ] as const).map((method) => {
                    const isSelected = paymentMethod === method.id
                    const isDisabled = isLoading || ('requiresCustomer' in method && method.requiresCustomer && !selectedCustomer)
                    return (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => setPaymentMethod(method.id)}
                        disabled={isDisabled}
                        title={'requiresCustomer' in method && method.requiresCustomer && !selectedCustomer ? "Selecciona un cliente primero" : undefined}
                        className={cn(
                          "flex flex-col items-center gap-2 p-3 rounded-xl border transition-all",
                          "disabled:opacity-35 disabled:cursor-not-allowed",
                          isSelected
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border hover:border-border/80 hover:bg-muted/30"
                        )}
                      >
                        <div className={cn(
                          "p-2 rounded-lg",
                          isSelected ? method.bgActive : "bg-muted/50"
                        )}>
                          <method.icon className={cn(
                            "h-5 w-5",
                            isSelected ? method.textActive : "text-muted-foreground"
                          )} />
                        </div>
                        <span className="text-xs font-semibold">{method.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Cash Input */}
              {paymentMethod === "cash" && (
                <div className="px-6 pb-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Banknote className="h-3.5 w-3.5" />
                    Monto Recibido
                  </div>
                  <div className="relative">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground pointer-events-none">
                      {getCurrencySymbol()}
                    </div>
                    <Input
                      id="amount"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={amountReceived}
                      onChange={handleAmountChange}
                      className="h-14 text-xl! text-right font-bold pl-20 pr-5 rounded-xl"
                      style={{ fontSize: '1.35rem' }}
                      autoFocus
                      disabled={isLoading}
                    />
                  </div>

                  {amountReceived && amountPaid >= total && (
                    <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20">
                      <span className="text-base font-semibold text-green-700 dark:text-green-400">Cambio</span>
                      <span className="text-xl font-bold text-green-700 dark:text-green-400 tabular-nums">
                        {formatCurrency(change)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Credit confirmation */}
              {isCredit && selectedCustomer && (
                <div className="px-6 pb-4">
                  <div className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <p className="text-sm text-amber-700 dark:text-amber-400 text-center">
                      Se registrará una deuda de <strong>{formatCurrency(total)}</strong> a nombre de <strong>{selectedCustomer.name}</strong>
                    </p>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="px-6 pb-4">
                  <div className="px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/20">
                    <p className="text-sm text-destructive text-center">{error}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-6 pt-4 border-t flex gap-3 shrink-0">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
                className="flex-1 h-12 text-base"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isLoading || !isValidPayment}
                className={cn(
                  "flex-1 h-12 text-base font-semibold",
                  isCredit && "bg-amber-600 hover:bg-amber-700 text-white"
                )}
              >
                {isLoading ? (
                  <>
                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Procesando...
                  </>
                ) : isCredit ? (
                  <>
                    <HandCoins className="h-5 w-5" />
                    Confirmar Fiado
                  </>
                ) : (
                  <><CheckCircle2 className="h-5 w-5" />Confirmar Pago</>
                )}
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Success Header */}
            <div className="p-6 pb-4 space-y-1.5 border-b shrink-0">
              <h2 className="text-2xl font-bold tracking-tight">
                {confirmedDetails?.isCredit ? "Venta a Crédito Registrada" : "Venta Completada"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {confirmedDetails?.isCredit
                  ? "La deuda fue registrada exitosamente"
                  : "La transacción se procesó exitosamente"}
              </p>
            </div>

            {/* Success Content */}
            <div className="px-6 py-8">
              <div className="flex flex-col items-center gap-5">
                <div className={cn(
                  "h-16 w-16 rounded-full border-2 flex items-center justify-center",
                  confirmedDetails?.isCredit
                    ? "bg-amber-500/10 border-amber-500/20"
                    : "bg-green-500/10 border-green-500/20"
                )}>
                  {confirmedDetails?.isCredit ? (
                    <HandCoins className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                  )}
                </div>

                <div className="w-full rounded-xl border divide-y text-sm">
                  {saleId && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-muted-foreground">Venta #</span>
                      <span className="font-bold text-base tabular-nums">{saleId}</span>
                    </div>
                  )}
                  {confirmedDetails?.customerName && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-muted-foreground">Cliente</span>
                      <span className="font-semibold">{confirmedDetails.customerName}</span>
                    </div>
                  )}
                  {discountAmount > 0 && (
                     <>
                        <div className="flex items-center justify-between px-4 py-3">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span className="font-medium tabular-nums">{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3 bg-red-500/5">
                          <span className="text-red-600 dark:text-red-400">Descuento</span>
                          <span className="font-medium text-red-600 dark:text-red-400 tabular-nums">-{formatCurrency(discountAmount)}</span>
                        </div>
                     </>
                  )}
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-bold text-lg tabular-nums">{formatCurrency(confirmedDetails?.total || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-muted-foreground">Método</span>
                    <div className="flex items-center gap-2">
                      {(confirmedDetails?.paymentMethod || paymentMethod) === "cash" ? (
                        <Banknote className="h-4 w-4 text-green-600 dark:text-green-400" />
                      ) : (confirmedDetails?.paymentMethod || paymentMethod) === "transfer" ? (
                        <ArrowRightLeft className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      ) : (confirmedDetails?.paymentMethod || paymentMethod) === "credit" ? (
                        <HandCoins className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <CreditCard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      )}
                      <span className="font-semibold">
                        {(confirmedDetails?.paymentMethod || paymentMethod) === "cash" ? "Efectivo" : 
                         (confirmedDetails?.paymentMethod || paymentMethod) === "transfer" ? "Transferencia" :
                         (confirmedDetails?.paymentMethod || paymentMethod) === "credit" ? "Fiado" : "Tarjeta"}
                      </span>
                    </div>
                  </div>
                  {(confirmedDetails?.paymentMethod || paymentMethod) === "cash" && (confirmedDetails?.change || change) > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 bg-green-500/5">
                      <span className="text-green-700 dark:text-green-400">Cambio</span>
                      <span className="font-bold text-lg text-green-700 dark:text-green-400 tabular-nums">
                        {formatCurrency(confirmedDetails?.change || change)}
                      </span>
                    </div>
                  )}
                  {confirmedDetails?.isCredit && (
                    <div className="flex items-center justify-between px-4 py-3 bg-amber-500/5">
                      <span className="text-amber-700 dark:text-amber-400">Estado</span>
                      <span className="font-bold text-amber-700 dark:text-amber-400">Pendiente de pago</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 pt-4 border-t space-y-3 shrink-0">
              <div className="flex gap-3">
                <Button
                  onClick={handlePrintTicket}
                  disabled={isPrinting || !saleId}
                  variant="outline"
                  className="flex-1 h-12 text-base"
                >
                  {isPrinting ? (
                    <>
                      <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      Imprimiendo...
                    </>
                  ) : (
                    <>
                      <Printer className="h-5 w-5" />
                      Imprimir Ticket
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => onOpenChange(false)}
                  disabled={isPrinting}
                  className="flex-1 h-12 text-base font-semibold"
                >
                  Cerrar
                </Button>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Puedes reimprimir desde el historial de ventas
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}