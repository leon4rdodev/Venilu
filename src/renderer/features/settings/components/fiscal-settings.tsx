import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Landmark,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
} from "lucide-react";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Switch } from "@components/ui/switch";
import { Skeleton } from "@components/ui/skeleton";
import {
  Dialog,
  DialogContent,
} from "@components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@components/ui/table";
import { toast } from "sonner";
import { WidgetHeader } from "@renderer/shared/components/widget-header";
import { useMinimumLoading } from "@hooks/use-minimum-loading";
import { usePermissions } from "@renderer/features/auth/hooks/use-permission";
import { useSettings } from "../hooks/use-settings";
import { IPCResponse } from "@shared/types/ipc";
import { cn } from "@lib/utils";

// ─── Tipos del contrato IPC fiscal (espejo de main/modules/fiscal) ──────────

type NcfType = "B01" | "B02" | "B04";

interface SequenceStatus {
  id: string;
  type: NcfType;
  from_number: number;
  to_number: number;
  next_number: number;
  expires_at?: string | null; // YYYY-MM-DD
  active: boolean;
  remaining: number;
  expired: boolean;
}

const NCF_TYPE_LABELS: Record<NcfType, string> = {
  B02: "Consumo",
  B01: "Crédito Fiscal",
  B04: "Nota de Crédito",
};

const NCF_TYPE_OPTIONS: { value: NcfType; label: string }[] = [
  { value: "B02", label: "B02 · Factura de Consumo" },
  { value: "B01", label: "B01 · Factura de Crédito Fiscal" },
  { value: "B04", label: "B04 · Nota de Crédito" },
];

const MAX_NCF_NUMBER = 99_999_999;

/** "2026-12-31" → "31 dic 2026" (sin desfase de zona horaria). */
function formatExpiryDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── Card 1: interruptor fiscal + tasa ITBIS + RNC ──────────────────────────

function FiscalToggleCard({ canEdit }: { canEdit: boolean }) {
  const { settings, updateSettings } = useSettings();
  const [rateInput, setRateInput] = useState<string>("");

  const fiscalEnabled = settings?.fiscal_enabled ?? false;
  const itbisRate = settings?.itbis_rate ?? 18;
  const businessRnc = settings?.business_tax_id?.trim() ?? "";

  useEffect(() => {
    setRateInput(String(itbisRate));
  }, [itbisRate]);

  const handleToggleFiscal = async (checked: boolean) => {
    const result = await updateSettings({ fiscal_enabled: checked });
    if (result.success) {
      toast.success(
        checked
          ? "Facturación con comprobantes activada"
          : "Facturación con comprobantes desactivada",
        {
          description: checked
            ? "Las ventas emitirán NCF según las secuencias configuradas."
            : "Las ventas se registrarán sin comprobante fiscal.",
        },
      );
    } else {
      toast.error("Error al guardar", { description: result.message });
    }
  };

  const commitItbisRate = async () => {
    const parsed = Number(rateInput);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 30) {
      setRateInput(String(itbisRate));
      if (rateInput.trim() !== "" && rateInput !== String(itbisRate)) {
        toast.error("Tasa inválida", { description: "Debe estar entre 0% y 30%" });
      }
      return;
    }
    if (parsed === itbisRate) return;
    const result = await updateSettings({ itbis_rate: parsed });
    if (result.success) {
      toast.success("Tasa de ITBIS actualizada", { description: `Nueva tasa: ${parsed}%` });
    } else {
      toast.error("Error al guardar", { description: result.message });
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <WidgetHeader
        icon={ReceiptText}
        title="Facturación con Comprobantes (NCF)"
        subtitle="Emite comprobantes fiscales de la DGII en cada venta"
      />

      <div className="mt-6 space-y-5">
        {/* Interruptor principal — guardado inmediato */}
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">Emitir comprobantes fiscales</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cada venta consumirá un NCF de las secuencias autorizadas por la DGII.
            </p>
          </div>
          <Switch
            checked={fiscalEnabled}
            onCheckedChange={handleToggleFiscal}
            disabled={!canEdit}
            aria-label="Emitir comprobantes fiscales"
          />
        </div>

        {/* Tasa de ITBIS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="itbis-rate" className="text-sm">Tasa de ITBIS (%)</Label>
            <Input
              id="itbis-rate"
              type="number"
              min={0}
              max={30}
              step="0.01"
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
              onBlur={commitItbisRate}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              disabled={!canEdit}
              className="h-9 tabular-nums"
            />
            <p className="text-xs text-muted-foreground">
              El ITBIS ya está incluido en tus precios de venta. Tasa vigente en RD: 18%.
            </p>
          </div>
        </div>

        {/* RNC del negocio */}
        {businessRnc ? (
          <div className="flex items-center justify-between gap-4 rounded-lg bg-muted/50 px-4 py-3">
            <span className="text-sm text-muted-foreground">RNC del negocio</span>
            <span className="text-sm font-mono tabular-nums font-medium">{businessRnc}</span>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" strokeWidth={1.75} />
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Configura el RNC de tu negocio en Ajustes → Negocio: es obligatorio en los comprobantes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Dialog crear/editar secuencia ──────────────────────────────────────────

interface SequenceFormData {
  type: NcfType;
  from_number: string;
  to_number: string;
  next_number: string;
  expires_at: string;
  active: boolean;
}

function emptyForm(): SequenceFormData {
  return {
    type: "B02",
    from_number: "",
    to_number: "",
    next_number: "",
    expires_at: "",
    active: true,
  };
}

function SequenceDialog({
  open,
  onOpenChange,
  sequence,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sequence: SequenceStatus | null;
  onSaved: () => void;
}) {
  const isEditing = !!sequence;
  const [formData, setFormData] = useState<SequenceFormData>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  // Re-sincroniza el formulario cada vez que el dialog abre (el componente
  // permanece montado entre aperturas).
  useEffect(() => {
    if (!open) return;
    setFormData(
      sequence
        ? {
            type: sequence.type,
            from_number: String(sequence.from_number),
            to_number: String(sequence.to_number),
            next_number: String(sequence.next_number),
            expires_at: sequence.expires_at ?? "",
            active: sequence.active,
          }
        : emptyForm(),
    );
  }, [open, sequence]);

  const parseIntField = (value: string): number => Math.round(Number(value));

  const validate = (): string | null => {
    const from = parseIntField(formData.from_number);
    const to = parseIntField(formData.to_number);
    if (!Number.isInteger(from) || from < 1 || from > MAX_NCF_NUMBER) {
      return "El número inicial debe ser un entero entre 1 y 99,999,999";
    }
    if (!Number.isInteger(to) || to < from || to > MAX_NCF_NUMBER) {
      return "El número final debe ser un entero mayor o igual al inicial (máx. 99,999,999)";
    }
    if (isEditing) {
      const next = parseIntField(formData.next_number);
      if (!Number.isInteger(next) || next < from) {
        return "El próximo número debe ser un entero dentro del rango";
      }
    }
    return null;
  };

  const handleSave = async () => {
    const error = validate();
    if (error) {
      toast.error("Datos inválidos", { description: error });
      return;
    }
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        type: formData.type,
        from_number: parseIntField(formData.from_number),
        to_number: parseIntField(formData.to_number),
        expires_at: formData.expires_at || null,
        active: formData.active,
      };
      if (isEditing && sequence) {
        payload.id = sequence.id;
        payload.next_number = parseIntField(formData.next_number);
      }
      const result = (await window.ipcRenderer.invoke(
        "fiscal:save-sequence",
        payload,
      )) as IPCResponse<SequenceStatus>;

      if (result.success) {
        toast.success(isEditing ? "Secuencia actualizada" : "Secuencia registrada");
        onOpenChange(false);
        onSaved();
      } else {
        toast.error("No se pudo guardar la secuencia", { description: result.message });
      }
    } catch (err) {
      toast.error("No se pudo guardar la secuencia", {
        description: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const canSubmit = formData.from_number.trim() !== "" && formData.to_number.trim() !== "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border space-y-1 shrink-0">
          <h2 className="text-lg font-semibold tracking-tight">
            {isEditing ? "Editar Secuencia" : "Nueva Secuencia"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isEditing
              ? "Modifica el rango autorizado por la DGII"
              : "Registra un rango de NCF autorizado por la DGII"}
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 flex-1 overflow-y-auto min-h-0">
          <div className="space-y-2">
            <Label htmlFor="ncf-type">Tipo de Comprobante</Label>
            <Select
              value={formData.type}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, type: value as NcfType }))
              }
              disabled={isSaving || isEditing}
            >
              <SelectTrigger id="ncf-type" className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NCF_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="from_number">Desde</Label>
              <Input
                id="from_number"
                type="number"
                min={1}
                max={MAX_NCF_NUMBER}
                placeholder="1"
                value={formData.from_number}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, from_number: e.target.value }))
                }
                disabled={isSaving}
                className="h-9 bg-background tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to_number">Hasta</Label>
              <Input
                id="to_number"
                type="number"
                min={1}
                max={MAX_NCF_NUMBER}
                placeholder="500"
                value={formData.to_number}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, to_number: e.target.value }))
                }
                disabled={isSaving}
                className="h-9 bg-background tabular-nums"
              />
            </div>
          </div>

          {isEditing && (
            <div className="space-y-2">
              <Label htmlFor="next_number">Próximo número a emitir</Label>
              <Input
                id="next_number"
                type="number"
                min={1}
                max={MAX_NCF_NUMBER + 1}
                value={formData.next_number}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, next_number: e.target.value }))
                }
                disabled={isSaving}
                className="h-9 bg-background tabular-nums"
              />
              <p className="text-xs text-muted-foreground">
                No puede retroceder por debajo de lo ya emitido.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="expires_at">Fecha de Vencimiento (opcional)</Label>
            <Input
              id="expires_at"
              type="date"
              value={formData.expires_at}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, expires_at: e.target.value }))
              }
              disabled={isSaving}
              className="h-9 bg-background"
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3.5">
            <div className="min-w-0">
              <p className="text-sm font-medium">Activa</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Solo las secuencias activas emiten comprobantes.
              </p>
            </div>
            <Switch
              checked={formData.active}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, active: checked }))
              }
              disabled={isSaving}
              aria-label="Secuencia activa"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-border flex gap-3 shrink-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="flex-1 h-10"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSubmit || isSaving}
            className="flex-1 h-10"
          >
            {isSaving ? "Guardando..." : isEditing ? "Guardar Cambios" : "Registrar Secuencia"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Card 2: tabla de secuencias ────────────────────────────────────────────

function typePill(type: NcfType) {
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs font-medium text-foreground whitespace-nowrap">
      {type} · {NCF_TYPE_LABELS[type]}
    </span>
  );
}

function remainingPill(remaining: number) {
  if (remaining === 0) {
    return (
      <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium font-mono tabular-nums text-red-600 dark:text-red-400 whitespace-nowrap">
        0
      </span>
    );
  }
  if (remaining < 50) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-1 text-xs font-medium font-mono tabular-nums text-amber-600 dark:text-amber-400 whitespace-nowrap">
        {remaining.toLocaleString("es-DO")}
      </span>
    );
  }
  return (
    <span className="font-mono text-sm tabular-nums">{remaining.toLocaleString("es-DO")}</span>
  );
}

function SequencesCard({
  sequences,
  canEdit,
  fiscalEnabled,
  onRefetch,
}: {
  sequences: SequenceStatus[];
  canEdit: boolean;
  fiscalEnabled: boolean;
  onRefetch: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSequence, setEditingSequence] = useState<SequenceStatus | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SequenceStatus | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const missingB04 = !sequences.some(
    (s) => s.type === "B04" && s.active && !s.expired && s.remaining > 0,
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const result = (await window.ipcRenderer.invoke("fiscal:delete-sequence", {
        id: deleteTarget.id,
      })) as IPCResponse<void>;
      if (result.success) {
        toast.success(
          deleteTarget.next_number > deleteTarget.from_number
            ? "Secuencia desactivada"
            : "Secuencia eliminada",
          {
            description:
              deleteTarget.next_number > deleteTarget.from_number
                ? "Ya emitió comprobantes, por lo que se conserva desactivada."
                : undefined,
          },
        );
        setDeleteTarget(null);
        onRefetch();
      } else {
        toast.error("No se pudo eliminar la secuencia", { description: result.message });
      }
    } catch (err) {
      toast.error("No se pudo eliminar la secuencia", {
        description: err instanceof Error ? err.message : "Error desconocido",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const deleteTargetHasEmitted =
    !!deleteTarget && deleteTarget.next_number > deleteTarget.from_number;

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <WidgetHeader
        icon={Landmark}
        title="Secuencias de NCF"
        subtitle="Rangos de comprobantes autorizados por la DGII"
        action={
          canEdit ? (
            <Button
              size="sm"
              onClick={() => {
                setEditingSequence(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-2" strokeWidth={1.75} />
              Nueva Secuencia
            </Button>
          ) : undefined
        }
      />

      {fiscalEnabled && missingB04 && (
        <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" strokeWidth={1.75} />
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Sin secuencia B04 activa no podrás anular ventas con comprobante.
          </p>
        </div>
      )}

      <div className="mt-4">
        {sequences.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-3">
              <Landmark className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              No hay secuencias registradas
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              Registra aquí los rangos de NCF que la DGII autorizó a tu negocio
              (B02 para consumo, B01 para crédito fiscal y B04 para notas de
              crédito de anulaciones).
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead className="text-xs text-muted-foreground font-medium">Tipo</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-medium">Rango</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-medium">Próximo</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-medium">Restantes</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-medium">Vence</TableHead>
                    <TableHead className="text-xs text-muted-foreground font-medium">Estado</TableHead>
                    {canEdit && (
                      <TableHead className="text-xs text-muted-foreground font-medium text-right">
                        Acciones
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border [&_tr]:border-0">
                  {sequences.map((seq) => (
                    <TableRow key={seq.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell>{typePill(seq.type)}</TableCell>
                      <TableCell className="font-mono text-sm tabular-nums whitespace-nowrap">
                        {seq.from_number.toLocaleString("es-DO")}–{seq.to_number.toLocaleString("es-DO")}
                      </TableCell>
                      <TableCell className="font-mono text-sm tabular-nums whitespace-nowrap">
                        {seq.next_number > seq.to_number
                          ? "—"
                          : seq.next_number.toLocaleString("es-DO")}
                      </TableCell>
                      <TableCell>{remainingPill(seq.remaining)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {seq.expired ? (
                          <span className="inline-flex items-center rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 whitespace-nowrap">
                            Vencida
                          </span>
                        ) : seq.expires_at ? (
                          <span className="text-sm text-muted-foreground">
                            {formatExpiryDate(seq.expires_at)}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium whitespace-nowrap",
                            seq.active
                              ? "bg-foreground text-background"
                              : "border border-border text-muted-foreground",
                          )}
                        >
                          {seq.active ? "Activa" : "Inactiva"}
                        </span>
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingSequence(seq);
                                setDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4 mr-1" strokeWidth={1.75} />
                              Editar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeleteTarget(seq)}
                            >
                              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>

      <SequenceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        sequence={editingSequence}
        onSaved={onRefetch}
      />

      {/* Confirmación de eliminación */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTargetHasEmitted ? "¿Desactivar Secuencia?" : "¿Eliminar Secuencia?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTargetHasEmitted
                ? "Esta secuencia ya emitió comprobantes, por lo que no puede borrarse: se desactivará y dejará de emitir NCF, pero su historial se conserva."
                : "La secuencia será eliminada permanentemente. Esta acción no se puede deshacer."}
              {deleteTarget && (
                <span className="mt-4 block p-4 bg-muted rounded-md text-sm">
                  <strong>{deleteTarget.type} · {NCF_TYPE_LABELS[deleteTarget.type]}</strong>
                  {" — rango "}
                  <span className="font-mono tabular-nums">
                    {deleteTarget.from_number.toLocaleString("es-DO")}–{deleteTarget.to_number.toLocaleString("es-DO")}
                  </span>
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteTargetHasEmitted ? "Desactivar" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Skeleton (réplica de las dos cards) ────────────────────────────────────

function FiscalSettingsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-2.5">
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="h-5 w-72" />
        </div>
        <div className="mt-6 space-y-5">
          <Skeleton className="h-[72px] w-full rounded-lg" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      </div>
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Skeleton className="w-8 h-8 rounded-full" />
            <Skeleton className="h-5 w-44" />
          </div>
          <Skeleton className="h-9 w-40" />
        </div>
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Sección Fiscal ─────────────────────────────────────────────────────────

export function FiscalSettings() {
  const { settings, isLoading: settingsLoading } = useSettings();
  const queryClient = useQueryClient();
  const perms = usePermissions("settings:edit");
  const canEdit = perms["settings:edit"];

  const sequencesQuery = useQuery({
    queryKey: ["ncf-sequences"],
    queryFn: async () => {
      if (!window.ipcRenderer) throw new Error("IPC Renderer no disponible");
      const result = (await window.ipcRenderer.invoke(
        "fiscal:get-sequences",
      )) as IPCResponse<SequenceStatus[]>;
      if (!result.success || !result.data) {
        throw new Error(result.message || "Error al cargar las secuencias de NCF");
      }
      return result.data;
    },
  });

  const showSkeleton = useMinimumLoading(
    settingsLoading || sequencesQuery.isPending,
    500,
  );

  if (showSkeleton) {
    return <FiscalSettingsSkeleton />;
  }

  if (sequencesQuery.isError) {
    return (
      <div className="space-y-6">
        <FiscalToggleCard canEdit={canEdit} />
        <div className="bg-card border border-border rounded-lg p-6">
          <WidgetHeader
            icon={Landmark}
            title="Secuencias de NCF"
            subtitle="Rangos de comprobantes autorizados por la DGII"
          />
          <div className="mt-4 flex items-start gap-2.5 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" strokeWidth={1.75} />
            <p className="text-sm text-destructive">
              {sequencesQuery.error instanceof Error
                ? sequencesQuery.error.message
                : "Error al cargar las secuencias de NCF"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <FiscalToggleCard canEdit={canEdit} />
      <SequencesCard
        sequences={sequencesQuery.data ?? []}
        canEdit={canEdit}
        fiscalEnabled={settings?.fiscal_enabled ?? false}
        onRefetch={() => {
          void queryClient.invalidateQueries({ queryKey: ["ncf-sequences"] });
        }}
      />
    </div>
  );
}
