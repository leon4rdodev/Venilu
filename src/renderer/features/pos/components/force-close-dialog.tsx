import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@components/ui/dialog";
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Cerrar Turno Forzosamente
          </DialogTitle>
          <DialogDescription>
            Estás a punto de cerrar el turno de otro usuario. Esta acción quedará registrada en el historial.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
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
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleForceClose} disabled={isLoading || !finalCash || !reason.trim()}>
            {isLoading ? "Cerrando..." : "Cerrar Turno"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
