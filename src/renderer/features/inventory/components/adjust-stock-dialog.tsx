import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
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
  // The field starts at the product's current stock each time the dialog
  // opens ("reset state on prop change" pattern, no effect needed).
  const resetKey = open && product ? `${product.id}:${product.stock}` : null;
  const [field, setField] = useState<{ key: string | null; value: string }>({
    key: resetKey,
    value: product ? String(product.stock) : "",
  });
  if (field.key !== resetKey) setField({ key: resetKey, value: product ? String(product.stock) : "" });
  const value = field.key === resetKey ? field.value : (product ? String(product.stock) : "");
  const setValue = (next: string) => setField({ key: resetKey, value: next });

  // Focus the input once the dialog is mounted (instead of autoFocus)
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, [open]);

  if (!product) return null;

  const parsed = Number.parseInt(value, 10);
  const newStock = Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
  const delta = newStock !== null ? newStock - product.stock : 0;
  const canSave = newStock !== null && newStock !== product.stock && !isSaving;
  const hasError = newStock === null && value !== "";
  const deltaLabel = delta > 0 ? `+${delta}` : String(delta);

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
            <div className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center shrink-0" aria-hidden="true">
              <Boxes className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <DialogTitle className="text-lg font-semibold tracking-tight">Ajustar Stock</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground truncate" title={product.name}>
            {product.name}
          </DialogDescription>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Stock actual</span>
            <span className="font-mono font-semibold tabular-nums">{product.stock}</span>
          </div>

          <div className="flex items-center gap-2" role="group" aria-label="Ajuste rápido">
            {QUICK_DELTAS.map((d) => {
              const units = Math.abs(d) === 1 ? "unidad" : "unidades";
              return (
                <Button
                  key={d}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 h-9 font-mono tabular-nums"
                  disabled={isSaving}
                  onClick={() => applyDelta(d)}
                  aria-label={d > 0 ? `Sumar ${d} ${units}` : `Restar ${Math.abs(d)} ${units}`}
                >
                  {d > 0 ? (
                    <Plus className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                  ) : (
                    <Minus className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
                  )}
                  {Math.abs(d)}
                </Button>
              );
            })}
          </div>

          <div className="space-y-2">
            <Label htmlFor="adjust-stock-value">Nuevo stock</Label>
            <Input
              id="adjust-stock-value"
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={isSaving}
              aria-invalid={hasError || undefined}
              aria-describedby={hasError ? "adjust-stock-error" : "adjust-stock-delta"}
              className="h-11 text-center text-lg font-semibold font-mono tabular-nums bg-background"
              ref={inputRef}
            />
            {hasError && (
              <p id="adjust-stock-error" className="text-xs text-destructive" role="alert">
                Ingresa un número entero mayor o igual a 0.
              </p>
            )}
          </div>

          <div
            id="adjust-stock-delta"
            className="flex items-center justify-between rounded-lg border border-border px-3.5 py-2.5 text-sm"
            aria-live="polite"
          >
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
              {deltaLabel}
              {delta !== 0 && (
                <span className="sr-only"> {Math.abs(delta) === 1 ? "unidad" : "unidades"}</span>
              )}
            </span>
          </div>
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
