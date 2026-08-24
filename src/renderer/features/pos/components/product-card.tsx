import { useMemo, createElement, memo } from "react";
import { Card } from "@components/ui/card";
import {
  Smartphone,
  Headphones,
  Cable,
  Shield,
  Cpu,
  Package,
} from "lucide-react";
import { formatCurrency } from "@lib/currency";
import { productImageSrc } from "@lib/image";
import { cn } from "@lib/utils";

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
  const isLowStock = product.stock > 0 && product.stock <= (product.min_stock || 5);
  const imageSrc = productImageSrc(product.image);

  return (
    <Card
      className={cn(
        "group relative cursor-pointer border rounded-lg overflow-hidden transition-all duration-200 h-full flex flex-col bg-card p-0 gap-0",
        isOutOfStock
          ? "opacity-60 cursor-not-allowed bg-muted/20"
          : "hover:shadow-md hover:border-primary/40 hover:-translate-y-1 active:translate-y-0"
      )}
      onClick={() => !isOutOfStock && onAddToCart(product)}
    >
      {/* Photo — full-width hero on top */}
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
            <div className={cn("p-4 rounded-2xl", colorClasses.split(" ").slice(1).join(" "))}>
              {createElement(categoryIcon, { className: cn("h-10 w-10", colorClasses.split(" ")[0]) })}
            </div>
          </div>
        )}

        {/* Stock badge overlaid on the photo */}
        <span
          className={cn(
            "absolute top-2 right-2 text-[10px] font-bold px-2 py-1 rounded-full border shadow-sm whitespace-nowrap backdrop-blur-sm",
            isOutOfStock
              ? "bg-destructive/90 text-white border-destructive/20"
              : isLowStock
                ? "bg-amber-500/90 text-white border-amber-200/40"
                : "bg-background/85 text-foreground border-border/60"
          )}
        >
          {isOutOfStock ? "Agotado" : `${product.stock} disp.`}
        </span>
      </div>

      {/* Info below the photo */}
      <div className="p-3.5 flex-1 flex flex-col gap-1.5">
        <h3
          className="font-medium text-sm leading-snug text-foreground/90 group-hover:text-primary transition-colors duration-200 line-clamp-2"
          title={product.name}
        >
          {product.name}
        </h3>

        {product.category?.name && (
          <p className="text-[11px] text-muted-foreground truncate">{product.category.name}</p>
        )}

        <div className="pt-2 border-t border-border/50 mt-auto flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">Precio</p>
            <p className="text-lg font-bold text-primary tracking-tight truncate" title={formatCurrency(product.sale_price)}>
              {formatCurrency(product.sale_price)}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
});
