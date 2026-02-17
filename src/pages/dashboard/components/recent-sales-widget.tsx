import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";
import { formatTime } from "@/lib/formatters";
import { Clock, ShoppingBag } from "lucide-react";

interface RecentSale {
  id: number;
  sale_date: string;
  total_amount: number;
}

interface RecentSalesWidgetProps {
  sales: RecentSale[];
  loading: boolean;
}

export function RecentSalesWidget({ sales, loading }: RecentSalesWidgetProps) {
  return (
    <Card className="col-span-1 border-border/50 shadow-sm hover:shadow-md transition-shadow duration-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
           <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Clock className="h-5 w-5" />
          </div>
          <span>Ventas Recientes</span>
        </CardTitle>
        <CardDescription>
          Últimas transacciones realizadas en la tienda.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {loading ? (
             Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                    <div className="h-9 w-9 rounded-full bg-muted" />
                    <div className="space-y-2 flex-1">
                        <div className="h-4 w-1/3 bg-muted rounded" />
                        <div className="h-3 w-1/4 bg-muted rounded" />
                    </div>
                </div>
             ))
          ) : sales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-3">
                <Clock className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium mb-1 text-muted-foreground">Aún no hay ventas registradas</p>
            </div>
          ) : (
            sales.map((sale) => (
              <div key={sale.id} className="flex items-center justify-between group gap-4">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <Avatar className="h-10 w-10 border border-border/50 transition-transform group-hover:scale-105 shrink-0">
                    <AvatarFallback className="bg-primary/5 text-primary font-medium text-xs">
                         <ShoppingBag className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-1 min-w-0 flex-1">
                    <p className="text-sm font-medium leading-none group-hover:text-primary transition-colors truncate" title={`Venta #${sale.id}`}>
                      Venta #{sale.id}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatTime(sale.sale_date)}
                    </p>
                  </div>
                </div>
                <div className="font-medium text-sm tabular-nums whitespace-nowrap shrink-0" title={formatCurrency(sale.total_amount)}>
                    {formatCurrency(sale.total_amount)}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
