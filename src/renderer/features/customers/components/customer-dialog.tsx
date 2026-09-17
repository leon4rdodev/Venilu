import React, { useState, useEffect } from "react"
import { capitalizeWords } from '@lib/utils'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@components/ui/dialog"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { Label } from "@components/ui/label"
import { Textarea } from "@components/ui/textarea"
import { UserPlus, Save, Loader2 } from "lucide-react"
import { Customer } from "@shared/types/models"
import { formatPhoneNumber, getDigitsOnly } from "@lib/formatters"
import { getCurrencySymbol } from "@lib/currency"

interface CustomerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer?: Customer | null
  /** Devuelve false para mantener el diálogo abierto (p. ej. error del servidor) */
  onSave: (customerData: Partial<Customer>) => void | boolean | Promise<void | boolean>
}

// Validación ligera: solo evita errores evidentes ("correo@" o "sin arroba").
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function CustomerDialog({ open, onOpenChange, customer, onSave }: CustomerDialogProps) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")
  const [notes, setNotes] = useState("")
  const [creditLimit, setCreditLimit] = useState("")
  const [saving, setSaving] = useState(false)
  // Los errores se muestran junto al campo solo tras salir de él o al enviar
  // (HIG Entering data: "validate dynamically… as soon as you detect a problem").
  const [touched, setTouched] = useState<{ name?: boolean; email?: boolean }>({})

  const isEditing = !!customer

  useEffect(() => {
    if (customer) {
      setName(customer.name || "")
      setPhone(formatPhoneNumber(customer.phone || ""))
      setEmail(customer.email || "")
      setAddress(customer.address || "")
      setNotes(customer.notes || "")
      setCreditLimit(customer.credit_limit != null ? String(customer.credit_limit) : "")
    } else {
      setName("")
      setPhone("")
      setEmail("")
      setAddress("")
      setNotes("")
      setCreditLimit("")
    }
    setTouched({})
  }, [customer, open])

  const nameError = !name.trim() ? "El nombre es obligatorio." : null
  const emailError =
    email.trim() && !EMAIL_RE.test(email.trim()) ? "Ingresa un correo válido, p. ej. nombre@dominio.com." : null
  const canSubmit = !nameError && !emailError && !saving

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (nameError || emailError) {
      setTouched({ name: true, email: true })
      return
    }

    setSaving(true)
    try {
      const ok = await onSave({
        name: name.trim(),
        phone: getDigitsOnly(phone) || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
        credit_limit: creditLimit.trim() ? parseFloat(creditLimit) : null,
      })
      if (ok !== false) onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const showNameError = touched.name && nameError
  const showEmailError = touched.email && emailError

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0" noValidate aria-busy={saving || undefined}>
          {/* Header */}
          <div className="p-6 pb-4 pr-12 border-b border-border space-y-1 shrink-0">
            <DialogTitle className="text-lg font-semibold tracking-tight">
              {isEditing ? "Editar Cliente" : "Nuevo Cliente"}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {isEditing
                ? "Modifica los datos del cliente."
                : "Ingresa los datos del nuevo cliente."}
            </DialogDescription>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5 flex-1 overflow-y-auto min-h-0">
            <div className="space-y-2">
              <Label htmlFor="customer-name">
                Nombre
                <span className="text-destructive" aria-hidden="true">*</span>
                <span className="sr-only">(obligatorio)</span>
              </Label>
              <Input
                id="customer-name"
                value={name}
                onChange={(e) => {
                  // capitalizeWords entiende acentos ("Pérez" no se vuelve "PéRez")
                  setName(capitalizeWords(e.target.value))
                }}
                onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                placeholder="Nombre completo"
                autoComplete="off"
                required
                aria-required="true"
                aria-invalid={showNameError ? true : undefined}
                aria-describedby={showNameError ? "customer-name-error" : undefined}
              />
              {showNameError && (
                <p id="customer-name-error" role="alert" className="text-xs text-destructive">
                  {nameError}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer-phone">Teléfono</Label>
                <Input
                  id="customer-phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                  placeholder="809-000-0000"
                  autoComplete="off"
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-email">Email</Label>
                <Input
                  id="customer-email"
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  placeholder="correo@ejemplo.com"
                  autoComplete="off"
                  aria-invalid={showEmailError ? true : undefined}
                  aria-describedby={showEmailError ? "customer-email-error" : undefined}
                />
              </div>
              {showEmailError && (
                <p id="customer-email-error" role="alert" className="col-span-2 -mt-2 text-xs text-destructive">
                  {emailError}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-address">Dirección</Label>
              <Input
                id="customer-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Dirección del cliente"
                autoComplete="off"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-notes">Notas</Label>
              <Textarea
                id="customer-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas adicionales sobre el cliente..."
                rows={3}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-credit-limit">
                Límite de Crédito <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <div className="relative">
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none"
                  aria-hidden="true"
                >
                  {getCurrencySymbol()}
                </span>
                <Input
                  id="customer-credit-limit"
                  type="text"
                  inputMode="decimal"
                  value={creditLimit}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) setCreditLimit(v);
                  }}
                  placeholder="Sin límite"
                  autoComplete="off"
                  className="pl-10 text-right tabular-nums"
                  aria-describedby="customer-credit-limit-hint"
                />
              </div>
              <p id="customer-credit-limit-hint" className="text-xs text-muted-foreground">
                Dejar vacío para no aplicar límite.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 pt-4 border-t border-border flex gap-3 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="flex-1 h-10"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 h-10 gap-2"
            >
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />Guardando…</>
              ) : isEditing ? (
                <><Save className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />Guardar Cambios</>
              ) : (
                <><UserPlus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />Crear Cliente</>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
