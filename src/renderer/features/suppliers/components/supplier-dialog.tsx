import React, { useState } from "react";
import { capitalizeWords } from "@lib/utils";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Textarea } from "@components/ui/textarea";
import { Switch } from "@components/ui/switch";
import { Truck, Save } from "lucide-react";
import { Supplier } from "@shared/types/models";
import { formatPhoneNumber, getDigitsOnly, formatRNC } from "@lib/formatters";

interface SupplierDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: Supplier | null;
  /** Devuelve false para mantener el diálogo abierto (error del servidor). */
  onSave: (data: Partial<Supplier>) => Promise<boolean> | boolean;
}

interface FormState {
  name: string; rnc: string; contact_name: string; phone: string; email: string;
  address: string; notes: string; credit_days: string; active: boolean;
}

function buildForm(supplier: Supplier | null | undefined): FormState {
  return {
    name: supplier?.name ?? "",
    rnc: supplier?.rnc ? formatRNC(supplier.rnc) : "",
    contact_name: supplier?.contact_name ?? "",
    phone: supplier?.phone ? formatPhoneNumber(supplier.phone) : "",
    email: supplier?.email ?? "",
    address: supplier?.address ?? "",
    notes: supplier?.notes ?? "",
    credit_days: supplier ? String(supplier.credit_days ?? 0) : "0",
    active: supplier?.active ?? true,
  };
}

export function SupplierDialog({ open, onOpenChange, supplier, onSave }: SupplierDialogProps) {
  const isEditing = !!supplier;
  // Reset del formulario cada vez que se abre para otro suplidor
  const resetKey = open ? (supplier?.id ?? "new") : null;
  const [state, setState] = useState<{ key: string | null; form: FormState }>({ key: resetKey, form: buildForm(supplier) });
  if (state.key !== resetKey) setState({ key: resetKey, form: buildForm(supplier) });
  const form = state.key === resetKey ? state.form : buildForm(supplier);
  const set = (patch: Partial<FormState>) => setState({ key: resetKey, form: { ...form, ...patch } });

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const ok = await onSave({
        name: form.name.trim(),
        rnc: getDigitsOnly(form.rnc) || null,
        contact_name: form.contact_name.trim() || null,
        phone: getDigitsOnly(form.phone) || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
        credit_days: Number.parseInt(form.credit_days, 10) || 0,
        active: form.active,
      });
      if (ok !== false) onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
          <div className="p-6 pb-4 border-b border-border space-y-1 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center shrink-0">
                <Truck className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <DialogTitle className="text-lg font-semibold tracking-tight">
                {isEditing ? "Editar Suplidor" : "Nuevo Suplidor"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground">
              {isEditing ? "Modifica los datos del suplidor." : "Registra a quién le compras mercancía."}
            </DialogDescription>
          </div>

          <div className="p-6 space-y-4 flex-1 overflow-y-auto min-h-0">
            <div className="space-y-2">
              <Label htmlFor="supplier-name">Nombre o empresa *</Label>
              <Input id="supplier-name" value={form.name} onChange={(e) => set({ name: capitalizeWords(e.target.value) })} placeholder="Ej: Distribuidora Del Norte" required autoComplete="off" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplier-rnc">RNC</Label>
                <Input id="supplier-rnc" inputMode="numeric" value={form.rnc} onChange={(e) => set({ rnc: formatRNC(e.target.value) })} placeholder="1-01-00000-0" className="tabular-nums" autoComplete="off" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-contact">Contacto / vendedor</Label>
                <Input id="supplier-contact" value={form.contact_name} onChange={(e) => set({ contact_name: capitalizeWords(e.target.value) })} placeholder="Nombre del vendedor" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="supplier-phone">Teléfono</Label>
                <Input id="supplier-phone" type="tel" inputMode="tel" value={form.phone} onChange={(e) => set({ phone: formatPhoneNumber(e.target.value) })} placeholder="809-000-0000" className="tabular-nums" autoComplete="off" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier-email">Email</Label>
                <Input id="supplier-email" type="email" inputMode="email" value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="ventas@suplidor.com" autoComplete="off" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-address">Dirección</Label>
              <Input id="supplier-address" value={form.address} onChange={(e) => set({ address: e.target.value })} placeholder="Dirección del suplidor" />
            </div>
            <div className={isEditing ? "grid grid-cols-2 gap-4 items-start" : "grid grid-cols-1 gap-4"}>
              <div className="space-y-2">
                <Label htmlFor="supplier-credit-days">Días de crédito</Label>
                <Input
                  id="supplier-credit-days"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="365"
                  value={form.credit_days}
                  onChange={(e) => set({ credit_days: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                  placeholder="0"
                  aria-describedby="supplier-credit-days-help"
                  className="tabular-nums"
                />
                <p id="supplier-credit-days-help" className="text-xs text-muted-foreground">0 = paga de contado. Con crédito, las compras vencen a estos días.</p>
              </div>
              {isEditing && (
                <div className="space-y-2">
                  <Label htmlFor="supplier-active">Estado</Label>
                  <div className="flex items-center justify-between gap-3 rounded-full border border-input px-3.5 h-9">
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-none">{form.active ? "Activo" : "Inactivo"}</p>
                    </div>
                    <Switch id="supplier-active" checked={form.active} onCheckedChange={(v) => set({ active: v })} aria-label="Suplidor activo" />
                  </div>
                  <p className="text-xs text-muted-foreground">Un suplidor inactivo no aparece al registrar compras.</p>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-notes">Notas</Label>
              <Textarea id="supplier-notes" value={form.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Días de ruta, condiciones, productos que trae..." rows={2} />
            </div>
          </div>

          <div className="p-6 pt-4 border-t border-border flex gap-3 shrink-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving} className="flex-1 h-10">
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || !form.name.trim()} className="flex-1 h-10" aria-busy={saving}>
              <Save className="h-4 w-4" strokeWidth={1.75} />
              {saving ? "Guardando..." : isEditing ? "Guardar Cambios" : "Crear Suplidor"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
