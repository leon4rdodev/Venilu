import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowRight, PackageCheck } from "lucide-react";
import { WidgetHeader } from "@renderer/shared/components/widget-header";
import { Button } from "@components/ui/button";
import { cn } from "@lib/utils";
import { Product } from "@shared/types/models";

interface LowStockWidgetProps {
  products: Product[];
  loading: boolean;
}

const CRITICAL_STOCK = 2;

function subtitleFor(count: number, loading: boolean) {
  if (loading || count === 0) return "Productos con stock crítico";
  if (count === 1) return "1 producto con stock crítico";
  return `Top ${count} productos con stock crítico`;
}

/** "Atención a Reposición" — top products with critical stock. */
export function LowStockWidget({ products, loading }: LowStockWidgetProps) {
  const navigate = useNavigate();

  return (
    <section aria-busy={loading} className="bg-card border border-border rounded-lg p-6">
      <WidgetHeader
        icon={AlertTriangle}
        title="Atención a Reposición"
        subtitle={subtitleFor(products.length, loading)}
        danger={!loading && products.length > 0}
        action={
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate("/inventory")}
            className="-my-0.5 -mr-3 text-muted-foreground hover:text-foreground"
          >
            Ver inventario
            <ArrowRight aria-hidden="true" />
          </Button>
        }
      />

      <div className="mt-4">
        {loading ? (
          <div aria-hidden="true" className="divide-y divide-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between py-3 animate-pulse">
                <div className="h-4 w-1/2 bg-muted rounded" />
                <div className="h-6 w-16 bg-muted rounded-full" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
              <PackageCheck
                className="h-6 w-6 text-emerald-600 dark:text-emerald-400"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </div>
            <p className="text-sm font-medium text-foreground">¡Todo en orden!</p>
            <p className="text-xs text-muted-foreground mt-0.5">Inventario saludable</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {products.map((product) => {
              const critical = product.stock <= CRITICAL_STOCK;
              const severity = critical ? "Stock crítico" : "Stock bajo";
              return (
                <li key={product.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="text-sm font-medium text-foreground truncate min-w-0" title={product.name}>
                    {product.name}
                  </span>
                  <span
                    title={severity}
                    aria-label={`${product.stock} unidades, ${severity.toLowerCase()}`}
                    className={cn(
                      "inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 tabular-nums",
                      critical
                        ? "bg-destructive/10 text-destructive"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    )}
                  >
                    {critical && <AlertTriangle className="h-3 w-3" strokeWidth={2} aria-hidden="true" />}
                    {product.stock} unds
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
