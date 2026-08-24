import React, { useState, useEffect } from "react"
import { Dialog, DialogContent } from "@components/ui/dialog"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { Label } from "@components/ui/label"
import { Textarea } from "@components/ui/textarea"
import { UserPlus, Save } from "lucide-react"
import { Customer } from "@shared/types/models"
import { formatPhoneNumber, getDigitsOnly } from "@lib/formatters"

interface CustomerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer?: Customer | null
  onSave: (customerData: Partial<Customer>) => void
}

export function CustomerDialog({ open, onOpenChange, customer, onSave }: CustomerDialogProps) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")
  const [notes, setNotes] = useState("")
  const [creditLimit, setCreditLimit] = useState("")
  const [saving, setSaving] = useState(false)

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
  }, [customer, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        phone: getDigitsOnly(phone) || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        notes: notes.trim() || undefined,
        credit_limit: creditLimit.trim() ? parseFloat(creditLimit) : null,
      })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 overflow-hidden">
        <form onSubmit={handleSubmit} className="flex flex-col">
          {/* Header */}
          <div className="p-6 pb-4 border-b border-border space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">
              {isEditing ? "Editar Cliente" : "Nuevo Cliente"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isEditing
                ? "Modifica los datos del cliente."
                : "Ingresa los datos del nuevo cliente."}
            </p>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer-name">Nombre *</Label>
              <Input
                id="customer-name"
                value={name}
                onChange={(e) => {
                  const words = e.target.value
                  setName(words.replace(/\b\w/g, (c) => c.toUpperCase()))
                }}
                placeholder="Nombre completo"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="customer-phone">Teléfono</Label>
                <Input
                  id="customer-phone"
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                  placeholder="809-000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer-email">Email</Label>
                <Input
                  id="customer-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-address">Dirección</Label>
              <Input
                id="customer-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Dirección del cliente"
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
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-credit-limit">Límite de Crédito <span className="text-muted-foreground font-normal">(opcional)</span></Label>
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
              />
              <p className="text-[11px] text-muted-foreground">Dejar vacío para no aplicar límite.</p>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 pt-4 border-t border-border flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-10"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || saving}
              className="flex-1 h-10 gap-2"
            >
              {saving ? "Guardando..." : isEditing ? (
                <><Save className="h-4 w-4" strokeWidth={1.75} />Guardar Cambios</>
              ) : (
                <><UserPlus className="h-4 w-4" strokeWidth={1.75} />Crear Cliente</>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
