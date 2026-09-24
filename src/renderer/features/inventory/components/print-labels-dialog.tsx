import { useCallback, useEffect, useState } from "react";
import JsBarcode from "jsbarcode";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Barcode, Check } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@lib/currency";
import { cn } from "@lib/utils";
import { useSettings } from "@renderer/features/settings";
import { Product } from "@shared/types/models";

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 50;

/** Shared JsBarcode options — preview and printed labels look identical. */
const BARCODE_OPTIONS = {
  format: "CODE128",
  width: 2,
  height: 40,
  displayValue: true,
  fontSize: 10,
  margin: 0,
  lineColor: "#000000",
  background: "#ffffff",
} as const;

/** Escapes a string for safe interpolation inside HTML markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Renders the barcode with JsBarcode on an in-memory SVG and serializes it. */
function barcodeSvgMarkup(code: string): string {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, code, BARCODE_OPTIONS);
  return new XMLSerializer().serializeToString(svg);
}

/**
 * Builds the full thermal-printer HTML: N centered label blocks (name,
 * CODE128 barcode as inline SVG, price) separated by dashed cut lines.
 */
function buildLabelsHtml(args: {
  name: string;
  price: string;
  code: string;
  quantity: number;
  paperSize: string;
}): string {
  const { name, price, code, quantity, paperSize } = args;
  const barcodeSvg = barcodeSvgMarkup(code);

  const label = `
    <div class="label">
      <p class="name">${escapeHtml(name)}</p>
      <div class="barcode">${barcodeSvg}</div>
      <p class="price">${escapeHtml(price)}</p>
    </div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<style>
  @page { size: ${paperSize} auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${paperSize}; background: #fff; color: #000; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .label { padding: 4mm 3mm; text-align: center; }
  .label + .label { border-top: 1px dashed #000; }
  .name {
    font-size: 11px;
    font-weight: 700;
    line-height: 1.25;
    word-break: break-word;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    margin-bottom: 2mm;
  }
  .barcode svg { max-width: 100%; height: auto; }
  .price {
    font-family: "Courier New", ui-monospace, monospace;
    font-size: 16px;
    font-weight: 700;
    margin-top: 2mm;
  }
</style>
</head>
<body>${Array.from({ length: quantity }, () => label).join("")}
</body>
</html>`;
}

/**
 * Todos los códigos imprimibles de un producto: principal + adicionales.
 * El SKU queda solo como respaldo histórico para productos antiguos creados
 * sin códigos de barras.
 */
function printableCodes(product: Product | null): string[] {
  if (!product) return [];
  const codes = [product.barcode, ...(product.barcodes ?? []).map((b) => b.code)]
    .map((c) => (c ?? "").trim())
    .filter((c, i, all) => !!c && all.indexOf(c) === i);
  if (codes.length === 0) {
    const legacy = product.sku?.trim();
    if (legacy) return [legacy];
  }
  return codes;
}

interface PrintLabelsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}

/**
 * Impresión de etiquetas de producto para la impresora térmica configurada:
 * lista todos los códigos del producto e imprime cualquiera de ellos.
 * Vista previa (nombre, código de barras CODE128 y precio) y cantidad 1–50.
 * Sin códigos, bloquea la impresión.
 */
export function PrintLabelsDialog({ open, onOpenChange, product }: PrintLabelsDialogProps) {
  const { settings } = useSettings();
  const [quantity, setQuantity] = useState("1");
  const [isPrinting, setIsPrinting] = useState(false);
  const [barcodeError, setBarcodeError] = useState(false);
  /** Código elegido de la lista; null = el principal. */
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const codes = printableCodes(product);
  const code = (selectedCode && codes.includes(selectedCode) ? selectedCode : codes[0]) ?? null;

  // Callback ref: el Portal de Radix monta el contenido UN render después de
  // abrir, así que un useEffect([open]) corre antes de que el <svg> exista y
  // el preview quedaba en blanco. El callback ref dibuja el código de barras
  // en el instante exacto en que el nodo se monta (y se rehace si cambia code).
  const attachBarcode = useCallback((node: SVGSVGElement | null) => {
    if (!node || !code) return;
    try {
      JsBarcode(node, code, BARCODE_OPTIONS);
      setBarcodeError(false);
    } catch {
      setBarcodeError(true);
    }
  }, [code]);
  const paperSize = settings?.paper_size === "58mm" ? "58mm" : "80mm";

  // Fresh state on every open
  useEffect(() => {
    if (open) {
      setQuantity("1");
      setBarcodeError(false);
      setSelectedCode(null);
    }
  }, [open, product?.id]);

  if (!product) return null;

  const parsedQuantity = Number.parseInt(quantity, 10);
  const validQuantity =
    Number.isInteger(parsedQuantity) && parsedQuantity >= MIN_QUANTITY && parsedQuantity <= MAX_QUANTITY;
  const canPrint = !!code && !barcodeError && validQuantity && !isPrinting;
  const quantityHasError = !validQuantity && quantity !== "";

  const handlePrint = async () => {
    if (!code || !validQuantity) return;
    setIsPrinting(true);
    try {
      const html = buildLabelsHtml({
        name: product.name,
        price: formatCurrency(product.sale_price),
        code,
        quantity: parsedQuantity,
        paperSize,
      });
      const result = (await window.ipcRenderer.invoke("print-labels", { html })) as {
        success: boolean;
        message?: string;
      };
      if (result.success) {
        toast.success(
          parsedQuantity === 1 ? "Etiqueta enviada a la impresora" : `${parsedQuantity} etiquetas enviadas a la impresora`
        );
        onOpenChange(false);
      } else {
        toast.error("Error al imprimir etiquetas", { description: result.message });
      }
    } catch (err) {
      toast.error("Error al imprimir etiquetas", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border space-y-1 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center shrink-0" aria-hidden="true">
              <Barcode className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <DialogTitle className="text-lg font-semibold tracking-tight">Imprimir Etiquetas</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground truncate" title={product.name}>
            {product.name}
          </DialogDescription>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 flex-1 overflow-y-auto min-h-0">
          {code ? (
            <>
              {/* Todos los códigos del producto — elige cuál imprimir */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span id="print-codes-label" className="text-sm font-medium leading-none">
                    Código a imprimir
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {codes.length} {codes.length === 1 ? "código" : "códigos"}
                  </span>
                </div>
                <div role="radiogroup" aria-labelledby="print-codes-label" className="space-y-1.5">
                  {codes.map((c) => {
                    const isSelected = c === code;
                    const isPrincipal = c === (product.barcode ?? "").trim();
                    return (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        disabled={isPrinting}
                        onClick={() => setSelectedCode(c)}
                        title={isSelected ? "Código seleccionado" : `Imprimir con el código ${c}`}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                          isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                        )}
                      >
                        <Barcode className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                        <span className="font-mono text-sm min-w-0 flex-1 truncate">{c}</span>
                        {isPrincipal && (
                          <span className="rounded-full bg-muted text-xs px-2 py-0.5 text-muted-foreground shrink-0">
                            Principal
                          </span>
                        )}
                        <span
                          aria-hidden="true"
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                            isSelected ? "border-primary bg-primary text-primary-foreground" : "border-input"
                          )}
                        >
                          {isSelected && <Check className="h-3 w-3" strokeWidth={2.5} />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Label preview — mirrors the printed block */}
              {/* Fondo blanco intencional: simula el papel térmico también en modo oscuro */}
              <div
                className="rounded-lg border border-border bg-white text-black p-4 flex flex-col items-center text-center gap-2"
                role={barcodeError ? undefined : "img"}
                aria-label={
                  barcodeError
                    ? undefined
                    : `Vista previa de la etiqueta: ${product.name}, código ${code}, ${formatCurrency(product.sale_price)}`
                }
              >
                <p className="text-xs font-bold leading-snug line-clamp-2 break-words" title={product.name}>
                  {product.name}
                </p>
                {barcodeError ? (
                  <p className="text-xs text-destructive py-3" role="alert">
                    No se pudo generar el código de barras para «{code}».
                  </p>
                ) : (
                  <svg ref={attachBarcode} className="max-w-full" aria-hidden="true" focusable="false" />
                )}
                <p className="font-mono text-lg font-bold tabular-nums">
                  {formatCurrency(product.sale_price)}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="label-quantity">Cantidad de etiquetas</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {MIN_QUANTITY}–{MAX_QUANTITY}
                  </span>
                </div>
                <Input
                  id="label-quantity"
                  type="number"
                  inputMode="numeric"
                  min={MIN_QUANTITY}
                  max={MAX_QUANTITY}
                  step="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  disabled={isPrinting}
                  aria-invalid={quantityHasError || undefined}
                  aria-describedby={quantityHasError ? "label-quantity-error" : "label-print-hint"}
                  className="h-10 text-center font-mono tabular-nums bg-background"
                />
                {quantityHasError && (
                  <p id="label-quantity-error" className="text-xs text-destructive" role="alert">
                    Ingresa una cantidad entre {MIN_QUANTITY} y {MAX_QUANTITY}.
                  </p>
                )}
              </div>

              <p id="label-print-hint" className="text-xs text-muted-foreground">
                Se imprimirá en papel de {paperSize} usando la impresora configurada.
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                <Barcode className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.5} aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Este producto no tiene código de barras
              </p>
              <p className="text-sm text-muted-foreground mt-1 max-w-[260px]">
                Edita el producto y agrega códigos de barras para poder imprimir etiquetas.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-border flex gap-3 shrink-0">
          <Button variant="outline" className="flex-1 h-10" disabled={isPrinting} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="flex-1 h-10" disabled={!canPrint} onClick={handlePrint} aria-busy={isPrinting}>
            {isPrinting ? "Imprimiendo..." : "Imprimir Etiquetas"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
