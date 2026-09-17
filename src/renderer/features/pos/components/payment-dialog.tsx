import React, { useState, useEffect, useRef, useCallback } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@components/ui/dialog"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { Skeleton } from "@components/ui/skeleton"
import { Label } from "@components/ui/label"
import { CreditCard, Banknote, ArrowRightLeft, Printer, CheckCircle2, HandCoins, User2, Search, X, AlertCircle, ReceiptText, Loader2 } from "lucide-react"
import { formatCurrency, getCurrencySymbol } from "@lib/currency"
import { cn } from "@lib/utils"
import { toast } from "sonner"
import { PaymentMethod, Customer } from "@shared/types/models"
import { ipc } from "@lib/ipc"
import { formatPhone } from "@lib/formatters"
import { useSettings } from "@renderer/features/settings"
import { CustomerDialog } from "@renderer/features/customers/components/customer-dialog"
import { usePermission } from "@renderer/features/auth/hooks/use-permission"
import { PERMISSIONS } from "@shared/permissions"
import type { FiscalData } from "../hooks/use-cart"

type NcfChoice = "none" | "B02" | "B01"

type PaymentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  subtotal: number
  discountAmount: number
  total: number
  selectedCustomer: Customer | null
  /** ITBIS incluido en el total (calculado por el carrito) — solo se muestra con facturación activa */
  itbisIncluded?: number
  onSelectCustomer: (customer: Customer | null) => void
  onComplete: (paymentMethod: PaymentMethod, amountPaid: number, changeGiven: number, fiscal?: FiscalData) => Promise<{ success: boolean, saleId?: string, ncf?: string, message?: string }>
}

// Inline customer selector for the payment dialog
function InlineCustomerSelector({ selectedCustomer, onSelectCustomer }: { selectedCustomer: Customer | null, onSelectCustomer: (c: Customer | null) => void }) {
  const [showSearch, setShowSearch] = useState(false)
  const [search, setSearch] = useState("")
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Crear un cliente sin salir de la venta (mismo formulario que en Clientes)
  const canCreate = usePermission(PERMISSIONS.CUST_CREATE)
  const [createOpen, setCreateOpen] = useState(false)

  const handleCreateCustomer = async (data: Partial<Customer>): Promise<boolean> => {
    try {
      const result = (await ipc.invoke("create-customer", data)) as { success: boolean; data?: Customer; message?: string }
      if (!result.success || !result.data) {
        toast.error("Error al crear cliente", { description: result.message })
        return false
      }
      toast.success("Cliente creado", { description: `${result.data.name} asignado a esta venta.` })
      // Refresca listas/estadísticas de Clientes y deja al nuevo cliente en el pedido
      window.dispatchEvent(new Event("customers-updated"))
      onSelectCustomer(result.data)
      setShowSearch(false)
      setSearch("")
      return true
    } catch (error) {
      toast.error("Error al crear cliente", { description: error instanceof Error ? error.message : "Error inesperado" })
      return false
    }
  }

  const createButton = canCreate ? (
    <button
      type="button"
      onClick={() => setCreateOpen(true)}
      title="Crear cliente nuevo"
      aria-label="Crear cliente nuevo"
      className="h-9 shrink-0 flex items-center gap-0.5 px-2.5 rounded-full border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    >
      <User2 className="h-4 w-4" strokeWidth={1.75} />
      <span className="text-sm font-semibold leading-none">+</span>
    </button>
  ) : null

  const createDialog = canCreate ? (
    <CustomerDialog open={createOpen} onOpenChange={setCreateOpen} customer={null} onSave={handleCreateCustomer} />
  ) : null

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
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-muted/50">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
          <User2 className="h-4 w-4 text-foreground" strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" title={selectedCustomer.name}>{selectedCustomer.name}</p>
          {Number(selectedCustomer.balance) > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Deuda pendiente: {formatCurrency(Number(selectedCustomer.balance))}
            </p>
          )}
          {selectedCustomer.phone && Number(selectedCustomer.balance) <= 0 && (
            <p className="text-xs text-muted-foreground">{formatPhone(selectedCustomer.phone)}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => { onSelectCustomer(null); setShowSearch(false); setSearch("") }}
          aria-label="Quitar cliente de la venta"
          title="Quitar cliente"
          className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-[1px] focus-visible:ring-ring"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
    )
  }

  if (showSearch) {
    return (
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="p-2.5 border-b border-border bg-card flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o teléfono..."
              aria-label="Buscar cliente por nombre o teléfono"
              className="h-9 pl-9 text-sm bg-background"
            />
          </div>
          {createButton}
        </div>
        <div className="max-h-36 overflow-y-auto">
          {loading ? (
            <div>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-3.5 py-2.5 border-b last:border-b-0 border-border">
                  <Skeleton className="w-8 h-8 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-5 text-sm text-muted-foreground">
              {search ? "No se encontraron clientes" : "No hay clientes registrados"}
            </div>
          ) : (
            customers.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { onSelectCustomer(c); setShowSearch(false); setSearch("") }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none transition-colors border-b last:border-b-0 border-border"
              >
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <User2 className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" title={c.name}>{c.name}</p>
                  {c.phone && <p className="text-xs text-muted-foreground">{formatPhone(c.phone)}</p>}
                </div>
                {Number(c.balance) > 0 && (
                  <span
                    className="text-xs font-medium text-amber-600 dark:text-amber-400 whitespace-nowrap"
                    title={`Deuda pendiente: ${formatCurrency(Number(c.balance))}`}
                  >
                    {formatCurrency(Number(c.balance))}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
        <div className="p-2 border-t border-border">
          <button
            type="button"
            onClick={() => { setShowSearch(false); setSearch("") }}
            className="w-full h-8 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-[1px] focus-visible:ring-ring"
          >
            Cancelar búsqueda
          </button>
        </div>
        {createDialog}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setShowSearch(true)}
        className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed border-border hover:bg-muted/50 transition-colors text-left focus-visible:outline-none focus-visible:ring-[1px] focus-visible:ring-ring focus-visible:border-ring"
      >
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
          <User2 className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground">Sin cliente asignado</p>
          <p className="text-xs text-muted-foreground">Toca para buscar y asignar un cliente</p>
        </div>
      </button>
      {createButton}
      {createDialog}
    </div>
  )
}

export function PaymentDialog({ open, onOpenChange, subtotal, discountAmount, total, selectedCustomer, itbisIncluded, onSelectCustomer, onComplete }: PaymentDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash")
  const [amountReceived, setAmountReceived] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [saleId, setSaleId] = useState<string | undefined>(undefined)
  const [isPrinting, setIsPrinting] = useState(false)
  const amountInputRef = useRef<HTMLInputElement>(null)
  const { settings } = useSettings()

  // Comprobante fiscal (NCF) — solo cuando settings.fiscal_enabled
  const [ncfChoice, setNcfChoice] = useState<NcfChoice>("none")
  const [fiscalRnc, setFiscalRnc] = useState("")
  const [fiscalName, setFiscalName] = useState("")
  const [issuedNcf, setIssuedNcf] = useState<string | undefined>(undefined)

  // Focus the cash amount input when the dialog opens with cash selected,
  // or when the user switches back to the cash payment method
  useEffect(() => {
    if (open && paymentMethod === "cash" && !showSuccess) {
      const id = setTimeout(() => amountInputRef.current?.focus(), 50)
      return () => clearTimeout(id)
    }
  }, [open, paymentMethod, showSuccess])

  const [confirmedDetails, setConfirmedDetails] = useState<{
    total: number
    subtotal: number
    discountAmount: number
    paymentMethod: PaymentMethod
    change: number
    isCredit: boolean
    customerName?: string
    ncfType?: NcfChoice
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
        setNcfChoice("none")
        setFiscalRnc("")
        setFiscalName("")
        setIssuedNcf(undefined)
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
  const change = paymentMethod === "cash" ? Math.max(0, Math.round((amountPaid - total) * 100) / 100) : 0
  const isCredit = paymentMethod === "credit"

  // B01 exige RNC (9 dígitos) o cédula (11 dígitos) del cliente
  const fiscalEnabled = Boolean(settings?.fiscal_enabled)
  const rncValid = /^(\d{9}|\d{11})$/.test(fiscalRnc)
  const isFiscalValid = !fiscalEnabled || ncfChoice !== "B01" || rncValid

  // Epsilon avoids float artifacts (e.g. 3 × 0.1) rejecting an exact payment
  const isValidPayment = (isCredit
    || paymentMethod === "card"
    || paymentMethod === "transfer"
    || (amountReceived && amountPaid >= total - 0.005))
    && isFiscalValid

  const handleConfirm = async () => {
    setIsLoading(true)
    setError(null)

    // Snapshot BEFORE the cart is cleared — the success screen must not read
    // live values that reset to 0 once the sale completes.
    const currentDetails = {
      total,
      subtotal,
      discountAmount,
      paymentMethod,
      change,
      isCredit,
      customerName: selectedCustomer?.name,
      ncfType: fiscalEnabled ? ncfChoice : "none",
    }

    const fiscal: FiscalData | undefined =
      fiscalEnabled && ncfChoice !== "none"
        ? {
            ncfType: ncfChoice,
            ...(ncfChoice === "B01"
              ? {
                  customerRnc: fiscalRnc,
                  customerName: fiscalName.trim() || undefined,
                }
              : {}),
          }
        : undefined

    try {
      const result = await onComplete(
        paymentMethod,
        isCredit ? 0 : (paymentMethod === "cash" ? amountPaid : total),
        isCredit ? 0 : change,
        fiscal
      )

      if (result.success) {
        setConfirmedDetails(currentDetails)
        setSaleId(result.saleId)
        setIssuedNcf(result.ncf)
        setShowSuccess(true)
        // Auto-print (Ajustes → Impresora): fire-and-forget so the success
        // screen never waits on the printer.
        if (settings?.auto_print_receipt && result.saleId) {
          void printTicket(result.saleId)
        }
      } else {
        setError(result.message || "Error al procesar la venta")
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado")
    } finally {
      setIsLoading(false)
    }
  }

  const printTicket = async (id: string) => {
    if (!window.ipcRenderer) {
      toast.error("Error al imprimir", { description: "Sistema de impresión no disponible" })
      return
    }

    try {
      setIsPrinting(true)
      const result = await window.ipcRenderer.invoke("print-receipt", { saleId: id }) as { success: boolean; message?: string }

      if (result.success) {
        toast.success("Ticket impreso correctamente")
      } else {
        toast.error("Error al imprimir", { description: result.message || "No se pudo imprimir el ticket" })
      }
    } catch (_error) {
      toast.error("Error al imprimir")
    } finally {
      setIsPrinting(false)
    }
  }

  const handlePrintTicket = async () => {
    if (!saleId) {
      toast.error("Error al imprimir", { description: "Sistema de impresión no disponible" })
      return
    }
    await printTicket(saleId)
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
            <DialogHeader className="p-6 pb-4 gap-1 text-left border-b border-border shrink-0">
              <DialogTitle className="tracking-tight">Procesar Pago</DialogTitle>
              <DialogDescription>
                Selecciona el cliente, método de pago y confirma
              </DialogDescription>
            </DialogHeader>

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

              {/* Comprobante Fiscal (NCF) */}
              {fiscalEnabled && (
                <div className="px-6 pt-1 pb-3 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <ReceiptText className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Comprobante Fiscal
                  </div>
                  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tipo de comprobante fiscal">
                    {([
                      { id: "none", label: "Sin comprobante" },
                      { id: "B02", label: "Consumo (B02)" },
                      { id: "B01", label: "Crédito Fiscal (B01)" },
                    ] as const).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={ncfChoice === option.id}
                        onClick={() => setNcfChoice(option.id)}
                        disabled={isLoading}
                        className={cn(
                          "px-3.5 h-9 rounded-full border text-xs font-medium transition-colors whitespace-nowrap",
                          "disabled:opacity-50 disabled:cursor-not-allowed",
                          "focus-visible:outline-none focus-visible:ring-[1px] focus-visible:ring-ring focus-visible:border-ring",
                          ncfChoice === option.id
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {ncfChoice === "B01" && (
                    <div className="space-y-3 pt-0.5">
                      <div className="space-y-1.5">
                        <Label htmlFor="fiscal-rnc" className="text-xs text-muted-foreground">
                          RNC/Cédula del cliente
                        </Label>
                        <Input
                          id="fiscal-rnc"
                          type="text"
                          inputMode="numeric"
                          placeholder="RNC/Cédula del cliente"
                          value={fiscalRnc}
                          onChange={(e) => {
                            const value = e.target.value
                            if (/^\d{0,11}$/.test(value)) setFiscalRnc(value)
                          }}
                          disabled={isLoading}
                          aria-invalid={fiscalRnc.length > 0 && !rncValid ? true : undefined}
                          aria-describedby={fiscalRnc.length > 0 && !rncValid ? "fiscal-rnc-error" : undefined}
                          className="h-9 text-sm font-mono tabular-nums bg-background"
                        />
                        {fiscalRnc.length > 0 && !rncValid && (
                          <p id="fiscal-rnc-error" role="alert" className="text-xs text-destructive px-1">
                            Debe tener 9 dígitos (RNC) u 11 dígitos (cédula)
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="fiscal-name" className="text-xs text-muted-foreground">
                          Razón Social (opcional)
                        </Label>
                        <Input
                          id="fiscal-name"
                          type="text"
                          placeholder="Razón Social (opcional)"
                          value={fiscalName}
                          onChange={(e) => setFiscalName(e.target.value)}
                          disabled={isLoading}
                          className="h-9 text-sm bg-background"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Total Section */}
              <div className="px-6 pt-2 pb-3">
                <div className="rounded-lg border border-border divide-y divide-border">
                  {discountAmount > 0 && (
                    <>
                      <div className="flex items-baseline justify-between px-4 py-2.5">
                        <span className="text-sm text-muted-foreground">Subtotal</span>
                        <span className="text-sm font-medium font-mono tabular-nums">{formatCurrency(subtotal)}</span>
                      </div>
                      <div className="flex items-baseline justify-between px-4 py-2.5">
                        <span className="text-sm text-muted-foreground">Descuento</span>
                        <span className="text-sm font-medium font-mono tabular-nums text-muted-foreground">-{formatCurrency(discountAmount)}</span>
                      </div>
                    </>
                  )}
                  {settings?.fiscal_enabled && itbisIncluded !== undefined && (
                    <div className="flex items-baseline justify-between px-4 py-2.5">
                      <span className="text-sm text-muted-foreground">ITBIS incluido</span>
                      <span className="text-sm font-medium font-mono tabular-nums text-muted-foreground">{formatCurrency(itbisIncluded)}</span>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between px-4 py-3 bg-muted/50">
                    <span className="text-sm text-muted-foreground font-medium">Total a cobrar</span>
                    <span className="text-2xl font-semibold tracking-tight tabular-nums text-foreground truncate" title={formatCurrency(total)}>{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="px-6 pb-4 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <CreditCard className="h-3.5 w-3.5" />
                  Método de Pago
                </div>
                <div className="grid grid-cols-4 gap-2.5" role="radiogroup" aria-label="Método de pago">
                  {([
                    { id: "cash", label: "Efectivo", icon: Banknote },
                    { id: "card", label: "Tarjeta", icon: CreditCard },
                    { id: "transfer", label: "Transfer.", icon: ArrowRightLeft },
                    { id: "credit", label: "Crédito", icon: HandCoins, requiresCustomer: true },
                  ] as const).map((method) => {
                    const isSelected = paymentMethod === method.id
                    const isDisabled = isLoading || ('requiresCustomer' in method && method.requiresCustomer && !selectedCustomer)
                    return (
                      <button
                        key={method.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setPaymentMethod(method.id)}
                        disabled={isDisabled}
                        title={'requiresCustomer' in method && method.requiresCustomer && !selectedCustomer ? "Selecciona un cliente primero" : undefined}
                        className={cn(
                          "flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors",
                          "disabled:opacity-35 disabled:cursor-not-allowed",
                          "focus-visible:outline-none focus-visible:ring-[1px] focus-visible:ring-ring focus-visible:border-ring",
                          isSelected
                            ? "border-foreground bg-muted/50"
                            : "border-border hover:bg-muted/50"
                        )}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center",
                          isSelected ? "bg-muted text-foreground" : "bg-muted/50 text-muted-foreground"
                        )}>
                          <method.icon className="h-4 w-4" strokeWidth={1.75} />
                        </div>
                        <span className={cn(
                          "text-xs font-medium",
                          isSelected ? "text-foreground" : "text-muted-foreground"
                        )}>{method.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Cash Input */}
              {paymentMethod === "cash" && (
                <div className="px-6 pb-4 space-y-2.5">
                  <Label
                    htmlFor="payment-amount"
                    className="gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                  >
                    <Banknote className="h-3.5 w-3.5" />
                    Monto Recibido
                  </Label>
                  <div className="relative">
                    <div className="absolute left-5 top-1/2 -translate-y-1/2 text-xl font-semibold text-muted-foreground pointer-events-none" aria-hidden="true">
                      {getCurrencySymbol()}
                    </div>
                    <Input
                      ref={amountInputRef}
                      id="payment-amount"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={amountReceived}
                      onChange={handleAmountChange}
                      aria-describedby={amountReceived ? "payment-amount-feedback" : undefined}
                      className="h-14 text-xl! text-right font-semibold tabular-nums pl-20 pr-5 rounded-lg bg-background"
                      style={{ fontSize: '1.35rem' }}
                      disabled={isLoading}
                    />
                  </div>

                  {/* Live feedback: change to give back, or how much is still missing */}
                  <div id="payment-amount-feedback" aria-live="polite">
                    {amountReceived && amountPaid >= total - 0.005 ? (
                      <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Cambio</span>
                        <span className="text-lg font-semibold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums">
                          {formatCurrency(change)}
                        </span>
                      </div>
                    ) : amountReceived && amountPaid > 0 ? (
                      <p className="text-xs text-muted-foreground px-1 tabular-nums">
                        Faltan {formatCurrency(Math.round((total - amountPaid) * 100) / 100)} para cubrir el total
                      </p>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Credit confirmation */}
              {isCredit && selectedCustomer && (
                <div className="px-6 pb-4">
                  <div className="px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
                      Se registrará una deuda de <strong>{formatCurrency(total)}</strong> a nombre de <strong>{selectedCustomer.name}</strong>
                    </p>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="px-6 pb-4">
                  <div role="alert" className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-destructive" strokeWidth={1.75} />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-6 pt-4 border-t border-border flex gap-3 shrink-0">
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
                aria-busy={isLoading}
                className={cn(
                  "flex-1 h-11 font-medium",
                  isCredit && "bg-amber-600 hover:bg-amber-700 text-white"
                )}
              >
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Procesando...</>
                ) : isCredit ? (
                  <>
                    <HandCoins className="h-5 w-5" />
                    Confirmar Crédito
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
            <DialogHeader className="p-6 pb-4 gap-1 text-left border-b border-border shrink-0">
              <DialogTitle className="tracking-tight">
                {confirmedDetails?.isCredit ? "Venta a Crédito Registrada" : "Venta Completada"}
              </DialogTitle>
              <DialogDescription>
                {confirmedDetails?.isCredit
                  ? "La deuda fue registrada exitosamente"
                  : "La transacción se procesó exitosamente"}
              </DialogDescription>
            </DialogHeader>

            {/* Success Content */}
            <div className="px-6 py-8">
              <div className="flex flex-col items-center gap-5">
                <div className={cn(
                  "h-14 w-14 rounded-full flex items-center justify-center",
                  confirmedDetails?.isCredit ? "bg-amber-500/10" : "bg-emerald-500/10"
                )}>
                  {confirmedDetails?.isCredit ? (
                    <HandCoins className="h-7 w-7 text-amber-600 dark:text-amber-400" strokeWidth={1.75} />
                  ) : (
                    <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
                  )}
                </div>

                <div className="w-full rounded-lg border border-border divide-y divide-border text-sm">
                  {saleId && (
                    <div className="flex items-center justify-between gap-4 px-4 py-3">
                      <span className="text-muted-foreground shrink-0">Venta #</span>
                      <span className="font-medium font-mono tabular-nums truncate" title={saleId}>{saleId}</span>
                    </div>
                  )}
                  {issuedNcf && (
                    <div className="flex items-center justify-between gap-4 px-4 py-3 bg-muted/50">
                      <span className="text-muted-foreground font-medium shrink-0">
                        {confirmedDetails?.ncfType === "B01" ? "NCF Crédito Fiscal (B01)" : "NCF Consumo (B02)"}
                      </span>
                      <span className="font-semibold font-mono tabular-nums truncate" title={issuedNcf}>{issuedNcf}</span>
                    </div>
                  )}
                  {confirmedDetails?.customerName && (
                    <div className="flex items-center justify-between gap-4 px-4 py-3">
                      <span className="text-muted-foreground shrink-0">Cliente</span>
                      <span className="font-medium truncate" title={confirmedDetails.customerName}>{confirmedDetails.customerName}</span>
                    </div>
                  )}
                  {(confirmedDetails?.discountAmount ?? 0) > 0 && (
                     <>
                        <div className="flex items-center justify-between px-4 py-3">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span className="font-medium font-mono tabular-nums">{formatCurrency(confirmedDetails?.subtotal ?? 0)}</span>
                        </div>
                        <div className="flex items-center justify-between px-4 py-3">
                          <span className="text-muted-foreground">Descuento</span>
                          <span className="font-medium font-mono tabular-nums text-muted-foreground">-{formatCurrency(confirmedDetails?.discountAmount ?? 0)}</span>
                        </div>
                     </>
                  )}
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-semibold text-base font-mono tabular-nums">{formatCurrency(confirmedDetails?.total || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3">
                    <span className="text-muted-foreground">Método</span>
                    <div className="flex items-center gap-2">
                      {(confirmedDetails?.paymentMethod || paymentMethod) === "cash" ? (
                        <Banknote className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                      ) : (confirmedDetails?.paymentMethod || paymentMethod) === "transfer" ? (
                        <ArrowRightLeft className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                      ) : (confirmedDetails?.paymentMethod || paymentMethod) === "credit" ? (
                        <HandCoins className="h-4 w-4 text-amber-600 dark:text-amber-400" strokeWidth={1.75} />
                      ) : (
                        <CreditCard className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                      )}
                      <span className="font-medium">
                        {(confirmedDetails?.paymentMethod || paymentMethod) === "cash" ? "Efectivo" : 
                         (confirmedDetails?.paymentMethod || paymentMethod) === "transfer" ? "Transferencia" :
                         (confirmedDetails?.paymentMethod || paymentMethod) === "credit" ? "Crédito" : "Tarjeta"}
                      </span>
                    </div>
                  </div>
                  {(confirmedDetails?.paymentMethod ?? paymentMethod) === "cash" && (confirmedDetails?.change ?? 0) > 0 && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-muted-foreground">Cambio</span>
                      <span className="font-semibold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(confirmedDetails?.change ?? 0)}
                      </span>
                    </div>
                  )}
                  {confirmedDetails?.isCredit && (
                    <div className="flex items-center justify-between px-4 py-3">
                      <span className="text-muted-foreground">Estado</span>
                      <span className="rounded-full text-xs font-medium px-2 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400">Pendiente de pago</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-6 pt-4 border-t border-border space-y-3 shrink-0">
              <div className="flex gap-3">
                <Button
                  onClick={handlePrintTicket}
                  disabled={isPrinting || !saleId}
                  aria-busy={isPrinting}
                  variant="outline"
                  className="flex-1 h-11"
                >
                  {isPrinting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Imprimiendo...</>
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
                  className="flex-1 h-11 font-medium"
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