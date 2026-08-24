import { AlertTriangle, PackageCheck } from "lucide-react";
import { WidgetHeader } from "@renderer/shared/components/widget-header";
import { cn } from "@lib/utils";
import { Product } from "@shared/types/models";

interface LowStockWidgetProps {
  products: Product[];
  loading: boolean;
}

/** "Atención a Reposición" — top products with critical stock. */
export function LowStockWidget({ products, loading }: LowStockWidgetProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <WidgetHeader
        icon={AlertTriangle}
        title="Atención a Reposición"
        subtitle={`Top ${Math.max(products.length, 5)} productos con stock crítico`}
        danger
      />

      <div className="mt-4 divide-y divide-border">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3 animate-pulse">
              <div className="h-4 w-1/2 bg-muted rounded" />
              <div className="h-5 w-16 bg-muted rounded-full" />
            </div>
          ))
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
              <PackageCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" strokeWidth={1.75} />
            </div>
            <p className="text-sm font-medium">¡Todo en orden!</p>
            <p className="text-xs text-muted-foreground mt-0.5">Inventario saludable</p>
          </div>
        ) : (
          products.map((product) => (
            <div key={product.id} className="flex items-center justify-between gap-3 py-3">
              <span className="text-sm font-medium truncate min-w-0" title={product.name}>
                {product.name}
              </span>
              <span
                className={cn(
                  "text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap shrink-0",
                  product.stock <= 2
                    ? "bg-red-500/10 text-red-600 dark:text-red-400"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                )}
              >
                {product.stock} unds
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
