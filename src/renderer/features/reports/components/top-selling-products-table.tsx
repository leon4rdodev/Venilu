import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@components/ui/card"
import { formatCurrency } from "@lib/currency"
import { TrendingUp } from "lucide-react"
import { Badge } from "@components/ui/badge"

interface TopSellingProduct {
  productName: string;
  totalSold: number;
  totalRevenue: number;
}

interface TopSellingProductsTableProps {
  topSellingProducts: TopSellingProduct[];
  loading: boolean;
}

export const TopSellingProductsTable = React.memo(({ topSellingProducts, loading }: TopSellingProductsTableProps) => {
  return (
    <Card className="h-full border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-green-500" />
          Productos Más Vendidos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
             {Array.from({ length: 5 }).map((_, i) => (
               <div key={i} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                 <div className="flex items-center gap-3">
                   <div className="h-8 w-8 bg-muted/20 animate-pulse rounded-md" />
                   <div className="space-y-2">
                     <div className="h-4 w-32 bg-muted/20 animate-pulse rounded" />
                     <div className="h-3 w-24 bg-muted/20 animate-pulse rounded" />
                   </div>
                 </div>
                 <div className="space-y-2 flex flex-col items-end">
                    <div className="h-4 w-20 bg-muted/20 animate-pulse rounded" />
                    <div className="h-3 w-12 bg-muted/20 animate-pulse rounded" />
                 </div>
               </div>
             ))}
          </div>
        ) : topSellingProducts.length > 0 ? (
          <div className="space-y-4">
            {topSellingProducts.map((product, index) => (
              <div key={index} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0 gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Badge variant="secondary" className="text-lg font-bold shrink-0">
                    #{index + 1}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" title={product.productName}>{product.productName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      <span className="font-semibold">{product.totalSold}</span> unidades vendidas
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 whitespace-nowrap">
                  <p className="text-sm font-semibold">{formatCurrency(product.totalRevenue)}</p>
                  <p className="text-xs text-muted-foreground">ingresos</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-3">
              <TrendingUp className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium mb-1">No hay productos vendidos</p>
            <p className="text-xs text-muted-foreground">No se registraron ventas en el período seleccionado</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
