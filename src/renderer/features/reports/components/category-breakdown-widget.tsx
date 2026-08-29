import React from "react";
import { Tags } from "lucide-react";
import { WidgetHeader } from "@renderer/shared/components/widget-header";
import { formatCurrency } from "@lib/currency";
import type { CategoryBreakdownItem } from "../hooks/use-reports";

interface CategoryBreakdownWidgetProps {
  categoryBreakdown: CategoryBreakdownItem[];
  loading: boolean;
}

function CategoryRowsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between animate-pulse py-2">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-4 w-12 bg-muted rounded" />
          <div className="h-4 w-20 bg-muted rounded" />
          <div className="h-4 w-12 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}

/** Tabla compacta de rendimiento por categoría: unidades, ingresos y margen. */
export const CategoryBreakdownWidget = React.memo(
  ({ categoryBreakdown, loading }: CategoryBreakdownWidgetProps) => {
    return (
      <div className="bg-card border border-border rounded-lg p-6 h-full">
        <WidgetHeader icon={Tags} title="Ventas por Categoría" />

        <div className="mt-4 overflow-x-auto">
          {loading ? (
            <CategoryRowsSkeleton />
          ) : categoryBreakdown.length > 0 ? (
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="pb-2 pr-3 font-medium">Categoría</th>
                  <th className="pb-2 pr-3 font-medium text-right">Unidades</th>
                  <th className="pb-2 pr-3 font-medium text-right">Ingresos</th>
                  <th className="pb-2 font-medium text-right">Margen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {categoryBreakdown.map((category, index) => (
                  <tr key={index}>
                    <td className="py-3 pr-3 min-w-0">
                      <p className="text-sm font-medium truncate max-w-[180px]" title={category.categoryName}>
                        {category.categoryName}
                      </p>
                    </td>
                    <td className="py-3 pr-3 text-right text-sm text-muted-foreground font-mono tabular-nums whitespace-nowrap">
                      {category.totalSold}
                    </td>
                    <td className="py-3 pr-3 text-right text-sm font-medium font-mono tabular-nums whitespace-nowrap">
                      {formatCurrency(category.totalRevenue)}
                    </td>
                    <td className="py-3 text-right text-sm text-muted-foreground font-mono tabular-nums whitespace-nowrap">
                      {(category.margin ?? 0).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                <Tags className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Sin datos por categoría</p>
              <p className="text-xs text-muted-foreground">No se registraron ventas en el período seleccionado</p>
            </div>
          )}
        </div>
      </div>
    );
  },
);
