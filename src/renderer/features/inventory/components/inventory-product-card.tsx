import { createElement, useMemo, memo } from "react";
import { Card } from "@components/ui/card";
import { Button } from "@components/ui/button";
import { Pencil, Trash2, Boxes, History, Barcode, AlertTriangle, XCircle } from "lucide-react";
import { formatCurrency } from "@lib/currency";
import { productImageSrc } from "@lib/image";
import { cn } from "@lib/utils";
import { getCategoryIcon, getCategoryColor } from "@renderer/features/pos/components/product-card";
import { Product } from "@shared/types/models";

interface InventoryProductCardProps {
  product: Product;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  /** Quick stock adjustment (inventory:adjust_stock enforced server-side) */
  onAdjustStock?: (product: Product) => void;
  /** Opens the kardex (stock movements history) for this product */
  onViewMovements?: (product: Product) => void;
  /** Opens the barcode label printing dialog for this product */
  onPrintLabels?: (product: Product) => void;
  isLoading?: boolean;
}

/**
 * Inventory product card — same visual language as the POS card:
 * full-width 1:1 photo on top (category icon as fallback), info below,
 * plus the management-only data (SKU, cost price) and edit/delete actions.
 */
export const InventoryProductCard = memo(function InventoryProductCard({ product, onEdit, onDelete, onAdjustStock, onViewMovements, onPrintLabels, isLoading = false }: InventoryProductCardProps) {
  const categoryIcon = useMemo(() => getCategoryIcon(product.category?.name || ""), [product.category]);
  const colorClasses = useMemo(() => getCategoryColor(product.category?.name || ""), [product.category]);
  const minStock = product.min_stock || 5;
  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= minStock;
  const stockTitle = isOutOfStock
    ? "Agotado"
    : isLowStock
      ? `Stock bajo (mínimo ${minStock})`
      : `${product.stock} unidades`;
  const imageSrc = productImageSrc(product.image);
  // cost_price is stripped server-side when the user lacks inventory:view_costs
  const showCost = product.cost_price !== undefined && product.cost_price !== null;

  return (
    <Card className="group relative border rounded-lg overflow-hidden transition-all duration-200 h-full flex flex-col bg-card p-0 gap-0 hover:shadow-md hover:border-primary/40">
      {/* Photo — full-width 1:1 hero on top */}
      <div className="relative w-full aspect-square bg-muted/30 overflow-hidden shrink-0">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={product.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={cn("p-4 rounded-2xl", colorClasses.split(" ").slice(1).join(" "))} aria-hidden="true">
              {createElement(categoryIcon, { className: cn("h-10 w-10", colorClasses.split(" ")[0]) })}
            </div>
          </div>
        )}

        {/* Stock badge overlaid on the photo */}
        <span
          title={stockTitle}
          className={cn(
            "absolute top-2 right-2 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full border shadow-sm whitespace-nowrap tabular-nums backdrop-blur-sm",
            isOutOfStock
              ? "bg-destructive/90 text-white border-destructive/20"
              : isLowStock
                ? "bg-amber-500/90 text-white border-amber-200/40"
                : "bg-background/85 text-foreground border-border/60"
          )}
        >
          {isOutOfStock ? (
            <>
              <XCircle className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" />
              Agotado
            </>
          ) : isLowStock ? (
            <>
              <AlertTriangle className="h-3 w-3" strokeWidth={2.25} aria-hidden="true" />
              {product.stock} uds
              <span className="sr-only"> (stock bajo)</span>
            </>
          ) : (
            <>{product.stock} uds</>
          )}
        </span>

        {/* SKU chip */}
        {product.sku && (
          <span
            className="absolute bottom-2 left-2 text-[11px] font-mono px-2 py-0.5 rounded-md bg-background/85 border border-border/60 text-muted-foreground backdrop-blur-sm max-w-[80%] truncate"
            title={`SKU ${product.sku}`}
          >
            {product.sku}
          </span>
        )}
      </div>

      {/* Info below the photo */}
      <div className="p-3.5 flex-1 flex flex-col gap-1.5">
        <h3 className="font-medium text-sm leading-snug text-foreground line-clamp-2" title={product.name}>
          {product.name}
        </h3>

        {product.variant_name && (
          <span className="self-start rounded-full bg-muted text-xs px-2 py-0.5 text-muted-foreground truncate max-w-full" title={product.variant_name}>
            {product.variant_name}
          </span>
        )}

        {product.category?.name && (
          <p className="text-xs text-muted-foreground truncate" title={product.category.name}>{product.category.name}</p>
        )}

        {/* Prices */}
        <div className={cn("pt-2 border-t border-border/50 mt-auto grid gap-2", showCost ? "grid-cols-2" : "grid-cols-1")}>
          {showCost && (
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">Compra</p>
              <p className="text-sm font-semibold text-muted-foreground tabular-nums truncate" title={formatCurrency(product.cost_price)}>
                {formatCurrency(product.cost_price)}
              </p>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">Venta</p>
            <p className="text-base font-bold text-primary tracking-tight tabular-nums truncate" title={formatCurrency(product.sale_price)}>
              {formatCurrency(product.sale_price)}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2.5">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8"
            onClick={() => onEdit(product)}
            disabled={isLoading}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Editar
          </Button>
          {onPrintLabels && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => onPrintLabels(product)}
              disabled={isLoading}
              title="Imprimir etiquetas"
              aria-label={`Imprimir etiquetas de ${product.name}`}
            >
              <Barcode className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            </Button>
          )}
          {onViewMovements && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => onViewMovements(product)}
              disabled={isLoading}
              title="Movimientos de stock"
              aria-label={`Movimientos de stock de ${product.name}`}
            >
              <History className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            </Button>
          )}
          {onAdjustStock && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => onAdjustStock(product)}
              disabled={isLoading}
              title="Ajustar stock"
              aria-label={`Ajustar stock de ${product.name}`}
            >
              <Boxes className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:border-destructive/40"
            onClick={() => !product.has_sales && onDelete(product.id)}
            disabled={isLoading || !!product.has_sales}
            title={product.has_sales ? "No se puede eliminar: tiene ventas registradas" : "Eliminar"}
            aria-label={
              product.has_sales
                ? `No se puede eliminar ${product.name}: tiene ventas registradas`
                : `Eliminar ${product.name}`
            }
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </Card>
  );
});
