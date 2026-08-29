import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { Dialog, DialogContent } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Barcode } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@lib/currency";
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

interface PrintLabelsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}

/**
 * Impresión de etiquetas de producto para la impresora térmica configurada:
 * vista previa (nombre, código de barras CODE128 y precio) y cantidad 1–50.
 * Usa `product.barcode`, con `sku` como respaldo; sin ninguno, bloquea.
 */
export function PrintLabelsDialog({ open, onOpenChange, product }: PrintLabelsDialogProps) {
  const { settings } = useSettings();
  const [quantity, setQuantity] = useState("1");
  const [isPrinting, setIsPrinting] = useState(false);
  const [barcodeError, setBarcodeError] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const code = product?.barcode?.trim() || product?.sku?.trim() || null;
  const paperSize = settings?.paper_size === "58mm" ? "58mm" : "80mm";

  // Fresh state on every open
  useEffect(() => {
    if (open) {
      setQuantity("1");
      setBarcodeError(false);
    }
  }, [open, product?.id]);

  // Live preview — same options as the printed label
  useEffect(() => {
    if (!open || !code || !svgRef.current) return;
    try {
      JsBarcode(svgRef.current, code, BARCODE_OPTIONS);
      setBarcodeError(false);
    } catch {
      setBarcodeError(true);
    }
  }, [open, code]);

  if (!product) return null;

  const parsedQuantity = Number.parseInt(quantity, 10);
  const validQuantity =
    Number.isInteger(parsedQuantity) && parsedQuantity >= MIN_QUANTITY && parsedQuantity <= MAX_QUANTITY;
  const canPrint = !!code && !barcodeError && validQuantity && !isPrinting;

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
            <div className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center shrink-0">
              <Barcode className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <h2 className="text-lg font-semibold tracking-tight">Imprimir Etiquetas</h2>
          </div>
          <p className="text-sm text-muted-foreground truncate" title={product.name}>
            {product.name}
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 flex-1 overflow-y-auto min-h-0">
          {code ? (
            <>
              {/* Label preview — mirrors the printed block */}
              <div className="rounded-lg border border-border bg-white text-black p-4 flex flex-col items-center text-center gap-2">
                <p className="text-xs font-bold leading-snug line-clamp-2 break-words" title={product.name}>
                  {product.name}
                </p>
                {barcodeError ? (
                  <p className="text-xs text-destructive py-3">
                    No se pudo generar el código de barras para «{code}».
                  </p>
                ) : (
                  <svg ref={svgRef} className="max-w-full" />
                )}
                <p className="font-mono text-lg font-bold tabular-nums">
                  {formatCurrency(product.sale_price)}
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="label-quantity" className="text-sm font-medium">
                  Cantidad de etiquetas
                </label>
                <Input
                  id="label-quantity"
                  type="number"
                  min={MIN_QUANTITY}
                  max={MAX_QUANTITY}
                  step="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  disabled={isPrinting}
                  className="h-10 text-center font-mono tabular-nums bg-background"
                />
                {!validQuantity && quantity !== "" && (
                  <p className="text-xs text-destructive">
                    Ingresa una cantidad entre {MIN_QUANTITY} y {MAX_QUANTITY}.
                  </p>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Se imprimirá en papel de {paperSize} usando la impresora configurada.
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                <Barcode className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Este producto no tiene código de barras ni SKU
              </p>
              <p className="text-sm text-muted-foreground mt-1 max-w-[260px]">
                Agrégaselo para imprimir etiquetas
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-border flex gap-3 shrink-0">
          <Button variant="outline" className="flex-1 h-10" disabled={isPrinting} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="flex-1 h-10" disabled={!canPrint} onClick={handlePrint}>
            {isPrinting ? "Imprimiendo..." : "Imprimir Etiquetas"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
