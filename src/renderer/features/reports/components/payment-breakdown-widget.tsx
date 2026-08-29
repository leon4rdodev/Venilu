import React from "react";
import { CreditCard, Banknote, Landmark, HandCoins, Wallet, LucideIcon } from "lucide-react";
import { WidgetHeader } from "@renderer/shared/components/widget-header";
import { formatCurrency } from "@lib/currency";
import type { PaymentBreakdownItem, PaymentMethod } from "../hooks/use-reports";

const METHOD_META: Record<PaymentMethod, { label: string; icon: LucideIcon }> = {
  cash: { label: "Efectivo", icon: Banknote },
  card: { label: "Tarjeta", icon: CreditCard },
  transfer: { label: "Transferencia", icon: Landmark },
  credit: { label: "Crédito (pendiente)", icon: HandCoins },
};

interface PaymentBreakdownWidgetProps {
  paymentBreakdown: PaymentBreakdownItem[];
  loading: boolean;
}

function PaymentRowSkeleton() {
  return (
    <div className="py-3 animate-pulse">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-muted" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-24 bg-muted rounded" />
            <div className="h-3 w-16 bg-muted rounded" />
          </div>
        </div>
        <div className="space-y-1.5 flex flex-col items-end">
          <div className="h-3.5 w-20 bg-muted rounded" />
          <div className="h-3 w-10 bg-muted rounded" />
        </div>
      </div>
      <div className="h-1.5 w-full bg-muted rounded-full" />
    </div>
  );
}

/**
 * Desglose de ventas por método de pago: total, transacciones y % del total
 * con barra de progreso monocroma.
 */
export const PaymentBreakdownWidget = React.memo(
  ({ paymentBreakdown, loading }: PaymentBreakdownWidgetProps) => {
    const grandTotal = paymentBreakdown.reduce((sum, item) => sum + item.total, 0);

    return (
      <div className="bg-card border border-border rounded-lg p-6 h-full">
        <WidgetHeader icon={Wallet} title="Métodos de Pago" />

        <div className="mt-4">
          {loading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 4 }).map((_, i) => (
                <PaymentRowSkeleton key={i} />
              ))}
            </div>
          ) : paymentBreakdown.length > 0 ? (
            <div className="divide-y divide-border">
              {paymentBreakdown.map((item) => {
                const meta = METHOD_META[item.method] ?? { label: item.method, icon: Wallet };
                const Icon = meta.icon;
                const pct = grandTotal > 0 ? (item.total / grandTotal) * 100 : 0;

                return (
                  <div key={item.method} className="py-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center shrink-0">
                          <Icon className="h-4 w-4" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{meta.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.transactions} transacci{item.transactions === 1 ? "ón" : "ones"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium font-mono tabular-nums whitespace-nowrap">
                          {formatCurrency(item.total)}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">{pct.toFixed(1)}%</p>
                      </div>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                <Wallet className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Sin pagos registrados</p>
              <p className="text-xs text-muted-foreground">No se registraron ventas en el período seleccionado</p>
            </div>
          )}
        </div>
      </div>
    );
  },
);
