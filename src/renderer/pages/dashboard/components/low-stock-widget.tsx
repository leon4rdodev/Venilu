import { Badge } from "@components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@components/ui/card";
import { AlertTriangle, Package } from "lucide-react";
import { Product } from "@shared/types/models";

interface LowStockWidgetProps {
  products: Product[];
  loading: boolean;
}

export function LowStockWidget({ products, loading }: LowStockWidgetProps) {
  return (
    <Card className="col-span-1 border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
           <div className="p-2 bg-orange-500/10 rounded-lg text-orange-600 dark:text-orange-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <span>Alertas de Stock</span>
        </CardTitle>
        <CardDescription>
          Productos que requieren reabastecimiento urgente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
           {loading ? (
             Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between animate-pulse">
                    <div className="h-4 w-1/2 bg-muted rounded" />
                    <div className="h-5 w-16 bg-muted rounded" />
                </div>
             ))
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-3 ring-8 ring-green-500/5">
                <Package className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-sm font-medium mb-1">¡Todo en orden!</p>
              <p className="text-xs text-muted-foreground">Inventario saludable</p>
            </div>
          ) : (
            products.map((product, index) => (
              <div key={index} className="flex items-center justify-between group gap-4">
                <span className="text-sm font-medium group-hover:text-primary transition-colors truncate min-w-0" title={product.name}>{product.name}</span>
                <Badge variant="outline" className="gap-1 bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/50 shrink-0 whitespace-nowrap">
                   <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse shrink-0" />
                  {product.stock} u.
                </Badge>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
