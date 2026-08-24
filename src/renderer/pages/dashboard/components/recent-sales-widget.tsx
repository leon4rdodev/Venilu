import { useNavigate } from "react-router-dom";
import { Receipt, Banknote, CreditCard, Landmark, HandCoins } from "lucide-react";
import { WidgetHeader } from "@renderer/shared/components/widget-header";
import { formatCurrency } from "@lib/currency";
import { formatTime } from "@lib/formatters";
import { cn } from "@lib/utils";
import { Sale } from "@shared/types/models";

interface RecentSalesWidgetProps {
  sales: Sale[];
  loading: boolean;
}

const methodMeta: Record<string, { label: string; icon: typeof Banknote }> = {
  cash: { label: "Efectivo", icon: Banknote },
  card: { label: "Tarjeta", icon: CreditCard },
  transfer: { label: "Transf.", icon: Landmark },
  credit: { label: "Crédito", icon: HandCoins },
};

const statusMeta: Record<string, { label: string; cls: string }> = {
  paid: { label: "Completado", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  credit: { label: "Crédito", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  partial: { label: "Parcial", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  voided: { label: "Anulada", cls: "bg-red-500/10 text-red-600 dark:text-red-400" },
};

/** Compact Vercel-style recent sales table. */
export function RecentSalesWidget({ sales, loading }: RecentSalesWidgetProps) {
  const navigate = useNavigate();

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <WidgetHeader
        icon={Receipt}
        title="Ventas Recientes"
        action={
          <button
            onClick={() => navigate("/pos")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Ver todas
          </button>
        }
      />

      <div className="mt-4 overflow-x-auto">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between animate-pulse py-2">
                <div className="h-4 w-28 bg-muted rounded" />
                <div className="h-4 w-20 bg-muted rounded" />
                <div className="h-5 w-20 bg-muted rounded-full" />
                <div className="h-4 w-24 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : sales.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-3">
              <Receipt className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Aún no hay ventas registradas</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="text-muted-foreground border-b border-border text-xs">
                <th className="pb-2 font-medium">ID / Hora</th>
                <th className="pb-2 font-medium">Método</th>
                <th className="pb-2 font-medium">Estado</th>
                <th className="pb-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sales.map((sale) => {
                const method = methodMeta[sale.payment_method] ?? { label: sale.payment_method, icon: Receipt };
                const status = statusMeta[sale.status] ?? { label: sale.status, cls: "bg-muted text-muted-foreground" };
                const MethodIcon = method.icon;
                const isVoided = sale.status === "voided";
                return (
                  <tr key={sale.id}>
                    <td className="py-3 pr-3">
                      <div className="font-medium text-sm">#{sale.id}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatTime(sale.sale_date || sale.created_at)}
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground whitespace-nowrap">
                        <MethodIcon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                        {method.label}
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <span className={cn("px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap", status.cls)}>
                        {status.label}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "py-3 text-right font-mono text-sm font-medium tabular-nums whitespace-nowrap",
                        isVoided && "line-through text-muted-foreground"
                      )}
                    >
                      {formatCurrency(sale.total_amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
