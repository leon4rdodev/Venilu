
import { useMemo } from "react";
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

export const getCategoryColor = (category: string) => {
  const lower = category.toLowerCase();
  if (lower.includes("celular") || lower.includes("phone")) return "text-blue-500 bg-blue-500/10";
  if (lower.includes("audífono")) return "text-purple-500 bg-purple-500/10";
  if (lower.includes("cargador") || lower.includes("cable")) return "text-amber-500 bg-amber-500/10";
  if (lower.includes("protector") || lower.includes("funda")) return "text-green-500 bg-green-500/10";
  if (lower.includes("repuesto")) return "text-orange-500 bg-orange-500/10";
  if (lower.includes("accesorio")) return "text-cyan-500 bg-cyan-500/10";
  return "text-muted-foreground bg-muted/50";
};

import { Product } from "@shared/types/models";

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const Icon = useMemo(() => getCategoryIcon(product.category?.name || ""), [product.category]);
  const colorClasses = useMemo(() => getCategoryColor(product.category?.name || ""), [product.category]);
  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= (product.min_stock || 10);

  return (
    <Card
      className={cn(
        "group relative cursor-pointer border rounded-xl overflow-hidden transition-all duration-200 h-full flex flex-col justify-between bg-card",
        isOutOfStock
          ? "opacity-60 cursor-not-allowed bg-muted/20"
          : "hover:shadow-md hover:border-primary/40 hover:-translate-y-1 active:translate-y-0"
      )}
      onClick={() => !isOutOfStock && onAddToCart(product)}
    >
      {/* Top section: Icon and Stock Badge */}
      <div className="relative p-4 flex items-start justify-between gap-2">
        <div className={cn("p-2.5 rounded-xl transition-all duration-300 group-hover:scale-105 shrink-0", colorClasses.split(" ").slice(1).join(" "))}>
          <Icon className={cn("h-6 w-6", colorClasses.split(" ")[0])} />
        </div>
        
        <span
          className={cn(
            "text-[10px] font-bold px-2 py-1 rounded-full border shadow-sm shrink-0 whitespace-nowrap",
            isOutOfStock
              ? "bg-destructive/10 text-destructive border-destructive/20"
              : isLowStock
                ? "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-900/30 dark:text-amber-400"
                : "bg-secondary text-secondary-foreground border-transparent"
          )}
        >
          {isOutOfStock ? "Agotado" : `${product.stock} disp.`}
        </span>
      </div>

      {/* Product info */}
      <div className="px-4 pb-4 flex-1 flex flex-col justify-between gap-2">
        <h3 
          className="font-medium text-sm text-foreground/90 group-hover:text-primary transition-colors duration-200 truncate"
          title={product.name}
        >
          {product.name}
        </h3>
        
        <div className="pt-2 border-t border-border/50 mt-auto">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">Precio</p>
          <p className="text-lg font-bold text-primary tracking-tight truncate" title={formatCurrency(product.sale_price)}>
            {formatCurrency(product.sale_price)}
          </p>
        </div>
      </div>
    </Card>
  );
}
