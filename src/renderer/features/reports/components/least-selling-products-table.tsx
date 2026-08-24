import React from 'react';
import { TrendingDown } from "lucide-react";
import { WidgetHeader } from "@renderer/shared/components/widget-header";
import { formatCurrency } from "@lib/currency";

interface LeastSellingProduct {
  productName: string;
  totalSold: number;
  totalRevenue: number;
}

interface LeastSellingProductsTableProps {
  leastSellingProducts: LeastSellingProduct[];
  loading: boolean;
}

export const LeastSellingProductsTable = React.memo(({ leastSellingProducts, loading }: LeastSellingProductsTableProps) => {
  return (
    <div className="bg-card border border-border rounded-lg p-6 h-full">
      <WidgetHeader icon={TrendingDown} title="Productos Menos Vendidos" />

      <div className="mt-4 overflow-x-auto">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between animate-pulse py-2">
                <div className="h-4 w-6 bg-muted rounded" />
                <div className="h-4 w-32 bg-muted rounded" />
                <div className="h-4 w-16 bg-muted rounded" />
                <div className="h-4 w-20 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : leastSellingProducts.length > 0 ? (
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="pb-2 pr-3 font-medium w-8">#</th>
                <th className="pb-2 pr-3 font-medium">Producto</th>
                <th className="pb-2 pr-3 font-medium text-right">Unidades</th>
                <th className="pb-2 font-medium text-right">Ingresos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leastSellingProducts.map((product, index) => (
                <tr key={index}>
                  <td className="py-3 pr-3 text-xs font-medium text-muted-foreground tabular-nums">
                    {index + 1}
                  </td>
                  <td className="py-3 pr-3 min-w-0">
                    <p className="text-sm font-medium truncate max-w-[220px]" title={product.productName}>
                      {product.productName}
                    </p>
                  </td>
                  <td className="py-3 pr-3 text-right text-sm text-muted-foreground font-mono tabular-nums whitespace-nowrap">
                    {product.totalSold}
                  </td>
                  <td className="py-3 text-right text-sm font-medium font-mono tabular-nums whitespace-nowrap">
                    {formatCurrency(product.totalRevenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-3">
              <TrendingDown className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">No hay datos disponibles</p>
            <p className="text-xs text-muted-foreground">No se registraron ventas en el período seleccionado</p>
          </div>
        )}
      </div>
    </div>
  );
});
