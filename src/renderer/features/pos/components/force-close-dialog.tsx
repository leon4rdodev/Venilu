import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Textarea } from "@components/ui/textarea";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { ipc } from "@lib/ipc";

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
        <div className="p-5 pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">Cerrar Turno Forzosamente</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1 ml-[42px]">
            Estás a punto de cerrar el turno de otro usuario. Esta acción quedará registrada en el historial.
          </p>
        </div>

        <div className="p-5 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="finalCash">Efectivo Físico en Caja</Label>
            <Input
              id="finalCash"
              type="text"
              inputMode="decimal"
              value={finalCash}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) setFinalCash(v);
              }}
              placeholder="0.00"
              autoComplete="off"
              className="h-10 bg-background text-right font-mono tabular-nums"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="reason">Razón / Observaciones (Obligatorio)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: El cajero tuvo que salir de emergencia..."
              rows={3}
              className="bg-background resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="p-5 pt-4 border-t border-border flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleForceClose} disabled={isLoading || !finalCash || !reason.trim()}>
            {isLoading ? "Cerrando..." : "Cerrar Turno"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
