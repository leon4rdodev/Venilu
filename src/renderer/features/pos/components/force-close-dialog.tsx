import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Textarea } from "@components/ui/textarea";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ipc } from "@lib/ipc";
import { getCurrencySymbol } from "@lib/currency";

interface ForceCloseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shiftId?: string;
  onSuccess: () => void;
}

export function ForceCloseDialog({ open, onOpenChange, shiftId, onSuccess }: ForceCloseDialogProps) {
  const [finalCash, setFinalCash] = useState("");
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setFinalCash("");
      setReason("");
    }
  }, [open]);

  const handleForceClose = async () => {
    if (!shiftId) return;

    const parsedCash = parseFloat(finalCash);
    if (isNaN(parsedCash) || parsedCash < 0) {
      toast.error("Monto inválido", { description: "Por favor, ingresa un monto válido para el efectivo contado." });
      return;
    }

    if (!reason.trim()) {
      toast.error("Razón requerida", { description: "Debes especificar la razón del cierre forzoso." });
      return;
    }

    setIsLoading(true);
    try {
      const result = await ipc.invoke('shifts:forceClose', {
        shiftId,
        finalCash: parsedCash,
        reason: reason.trim()
      }) as { success: boolean, message?: string };

      if (result.success) {
        toast.success("Turno cerrado", { description: "El turno fue cerrado forzosamente de manera exitosa." });
        onSuccess();
        onOpenChange(false);
      } else {
        throw new Error(result.message || "Error al cerrar turno");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error inesperado';
      toast.error("Error", { description: message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 gap-1 text-left border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0" aria-hidden="true">
              <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <DialogTitle className="tracking-tight">Cerrar Turno Forzosamente</DialogTitle>
          </div>
          <DialogDescription className="ml-[42px]">
            Estás a punto de cerrar el turno de otro usuario. Esta acción quedará registrada en el historial.
          </DialogDescription>
        </DialogHeader>

        <div className="p-5 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="force-close-final-cash">Efectivo Físico en Caja</Label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground pointer-events-none" aria-hidden="true">
                {getCurrencySymbol()}
              </div>
              <Input
                id="force-close-final-cash"
                type="text"
                inputMode="decimal"
                value={finalCash}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) setFinalCash(v);
                }}
                placeholder="0.00"
                autoComplete="off"
                disabled={isLoading}
                className="h-10 pl-16 pr-4 bg-background text-right font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="force-close-reason">Razón / Observaciones (Obligatorio)</Label>
            <Textarea
              id="force-close-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: El cajero tuvo que salir de emergencia..."
              rows={3}
              disabled={isLoading}
              className="bg-background resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="p-5 pt-4 border-t border-border flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleForceClose}
            disabled={isLoading || !finalCash || !reason.trim()}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />Cerrando...</>
            ) : (
              "Cerrar Turno"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
