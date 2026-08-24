import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Boxes, Minus, Plus } from "lucide-react";
import { cn } from "@lib/utils";
import { Product } from "@shared/types/models";

interface AdjustStockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  /** Persists the new stock; resolves true on success (closes the dialog). */
  onAdjust: (productId: string, newStock: number) => Promise<boolean>;
  isSaving?: boolean;
}

const QUICK_DELTAS = [-10, -1, +1, +10];

/**
 * Quick stock adjustment (mature-POS style): current stock, +/- steppers and
 * direct entry, with a live preview of the resulting difference.
 * Server-side this requires the `inventory:adjust_stock` permission.
 */
export function AdjustStockDialog({ open, onOpenChange, product, onAdjust, isSaving = false }: AdjustStockDialogProps) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (open && product) setValue(String(product.stock));
  }, [open, product]);

  if (!product) return null;

  const parsed = Number.parseInt(value, 10);
  const newStock = Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  const delta = newStock !== null ? newStock - product.stock : 0;
  const canSave = newStock !== null && newStock !== product.stock && !isSaving;

  const applyDelta = (d: number) => {
    const base = newStock ?? product.stock;
    setValue(String(Math.max(0, base + d)));
  };

  const handleSave = async () => {
    if (newStock === null) return;
    const ok = await onAdjust(product.id, newStock);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center shrink-0">
              <Boxes className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">Ajustar Stock</h2>
          </div>
          <p className="text-sm text-muted-foreground truncate" title={product.name}>
            {product.name}
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Stock actual</span>
            <span className="font-mono font-semibold tabular-nums">{product.stock}</span>
          </div>

          <div className="flex items-center gap-2">
            {QUICK_DELTAS.map((d) => (
              <Button
                key={d}
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 h-9 font-mono tabular-nums"
                disabled={isSaving}
                onClick={() => applyDelta(d)}
              >
                {d > 0 ? <Plus className="h-3 w-3" strokeWidth={1.75} /> : <Minus className="h-3 w-3" strokeWidth={1.75} />}
                {Math.abs(d)}
              </Button>
            ))}
          </div>

          <Input
            type="number"
            min="0"
            step="1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={isSaving}
            className="h-11 text-center text-lg font-semibold font-mono tabular-nums bg-background"
            autoFocus
          />

          <div className="flex items-center justify-between rounded-lg border border-border px-3.5 py-2.5 text-sm">
            <span className="text-muted-foreground">Diferencia</span>
            <span
              className={cn(
                "font-mono font-semibold tabular-nums",
                delta > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : delta < 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-muted-foreground"
              )}
            >
              {delta > 0 ? `+${delta}` : delta}
            </span>
          </div>

          {newStock === null && value !== "" && (
            <p className="text-xs text-destructive">Ingresa un número entero mayor o igual a 0.</p>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-border flex gap-3">
          <Button variant="outline" className="flex-1 h-10" disabled={isSaving} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="flex-1 h-10" disabled={!canSave} onClick={handleSave}>
            {isSaving ? "Guardando..." : "Aplicar Ajuste"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
