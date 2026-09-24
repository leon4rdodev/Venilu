import { useMemo, createElement, memo } from "react";
import type { KeyboardEvent } from "react";
import { Card } from "@components/ui/card";
import {
  Smartphone,
  Headphones,
  Cable,
  Shield,
  Cpu,
  Package,
  TriangleAlert,
} from "lucide-react";
import { formatCurrency } from "@lib/currency";
import { productImageSrc } from "@lib/image";
import { cn } from "@lib/utils";
import { unitDef } from "@shared/units";

export const getCategoryIcon = (category: string) => {
  const lower = category.toLowerCase();
  if (lower.includes("celular") || lower.includes("teléfono") || lower.includes("phone")) return Smartphone;
  if (lower.includes("audífono") || lower.includes("auricular") || lower.includes("headphone")) return Headphones;
  if (lower.includes("cargador") || lower.includes("cable")) return Cable;
  if (lower.includes("protector") || lower.includes("funda") || lower.includes("case")) return Shield;
  if (lower.includes("repuesto") || lower.includes("pantalla") || lower.includes("batería")) return Cpu;
  if (lower.includes("accesorio")) return Package;
  return Package;
};

// Monochrome (Vercel-style): category icons are neutral — color is reserved
// for semantic states (stock, danger, success) only.
export const getCategoryColor = (_category: string) => {
  return "text-muted-foreground bg-muted";
};

import { Product } from "@shared/types/models";

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
}

/** Memoized — with a stable onAddToCart, typing in the search box only re-renders changed cards. */
export const ProductCard = memo(function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const categoryIcon = useMemo(() => getCategoryIcon(product.category?.name || ""), [product.category]);
  const colorClasses = useMemo(() => getCategoryColor(product.category?.name || ""), [product.category]);
  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= (product.min_stock ?? 5);
  const imageSrc = productImageSrc(product.image);
  // Precio por la medida del producto: "RD$120 / lb", "RD$45 / cj"…
  const unit = unitDef(product.unit);
  const priceLabel = unit.value === "unidad"
    ? formatCurrency(product.sale_price)
    : `${formatCurrency(product.sale_price)} / ${unit.abbr}`;

  const handleAdd = () => {
    if (!isOutOfStock) onAddToCart(product);
  };

  // The card is a div-based control: Enter/Space activate it like a native button.
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <Card
      role="button"
      tabIndex={isOutOfStock ? -1 : 0}
      aria-disabled={isOutOfStock || undefined}
      aria-label={`${product.name}, ${priceLabel}${isOutOfStock ? ", agotado" : ""}`}
      className={cn(
        "group relative cursor-pointer border rounded-lg overflow-hidden transition-all duration-200 h-full flex flex-col bg-card p-0 gap-0 shadow-none",
        "outline-none focus-visible:border-ring focus-visible:ring-[1px] focus-visible:ring-ring",
        isOutOfStock
          ? "opacity-60 cursor-not-allowed bg-muted/20"
          : "hover:shadow-md hover:border-primary/40 hover:-translate-y-1 active:translate-y-0 motion-reduce:hover:translate-y-0 motion-reduce:transition-none"
      )}
      onClick={handleAdd}
      onKeyDown={handleKeyDown}
    >
      {/* Photo — full-width hero on top */}
      <div className="relative w-full aspect-square bg-muted/30 overflow-hidden shrink-0">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={product.name}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={cn("p-4 rounded-2xl", colorClasses.split(" ").slice(1).join(" "))}>
              {createElement(categoryIcon, { className: cn("h-10 w-10", colorClasses.split(" ")[0]) })}
            </div>
          </div>
        )}

        {/* Stock badge overlaid on the photo */}
        <span
          className={cn(
            "absolute top-2 right-2 inline-flex items-center gap-1 h-6 text-[11px] leading-none font-semibold px-2 rounded-full border shadow-sm whitespace-nowrap backdrop-blur-sm tabular-nums",
            isOutOfStock
              ? "bg-destructive/90 text-white border-destructive/20"
              : isLowStock
                ? "bg-amber-500/90 text-white border-amber-200/40"
                : "bg-background/85 text-foreground border-border/60"
          )}
          title={isLowStock ? "Stock bajo" : undefined}
        >
          {isLowStock && <TriangleAlert className="h-3 w-3" strokeWidth={2} />}
          {isOutOfStock ? "Agotado" : `${product.stock} disp.`}
        </span>
      </div>

      {/* Info below the photo */}
      <div className="p-3 flex-1 flex flex-col gap-1.5">
        <h3
          className="font-medium text-sm leading-snug text-foreground line-clamp-2"
          title={product.name}
        >
          {product.name}
        </h3>

        {(product.variant_name || product.category?.name) && (
          <div className="flex items-center gap-1.5 min-w-0">
            {product.variant_name && (
              <span
                className="rounded-full bg-muted text-[11px] leading-none font-medium px-2 py-1 text-foreground whitespace-nowrap shrink-0 max-w-[60%] truncate"
                title={product.variant_name}
              >
                {product.variant_name}
              </span>
            )}
            {product.category?.name && (
              <p className="text-[11px] text-muted-foreground truncate" title={product.category.name}>
                {product.category.name}
              </p>
            )}
          </div>
        )}

        <div className="pt-2 border-t border-border/50 mt-auto flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">Precio</p>
            <p className="text-lg font-semibold text-foreground tracking-tight tabular-nums truncate" title={priceLabel}>
              {priceLabel}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
});
