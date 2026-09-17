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
    <li className="py-3 animate-pulse" aria-hidden="true">
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
    </li>
  );
}

/**
 * Desglose de ventas por método de pago: total, transacciones y % del total
 * con barra de progreso monocroma. El crédito se muestra como saldo pendiente,
 * fuera del 100 % y sin barra (no es dinero cobrado).
 */
export const PaymentBreakdownWidget = React.memo(
  ({ paymentBreakdown, loading }: PaymentBreakdownWidgetProps) => {
    // El crédito es saldo PENDIENTE, no ingreso: no entra en el 100 %.
    const grandTotal = paymentBreakdown
      .filter((item) => item.method !== "credit")
      .reduce((sum, item) => sum + item.total, 0);

    const caption = (item: PaymentBreakdownItem) => {
      const sales = `${item.transactions.toLocaleString("es-DO")} venta${item.transactions === 1 ? "" : "s"}`;
      if (item.method === "credit") return `${sales} fiada${item.transactions === 1 ? "" : "s"} · pendiente de cobro`;
      const abonos = item.debtPayments ?? 0;
      return abonos > 0 ? `${sales} · ${abonos.toLocaleString("es-DO")} abono${abonos === 1 ? "" : "s"}` : sales;
    };

    return (
      <section className="bg-card border border-border rounded-lg p-6 h-full" aria-label="Métodos de pago">
        <WidgetHeader
          icon={Wallet}
          title="Métodos de Pago"
          subtitle="Cobros del período por método. El crédito es saldo pendiente."
        />

        <div className="mt-4" aria-busy={loading}>
          {loading ? (
            <ul className="divide-y divide-border">
              {Array.from({ length: 4 }).map((_, i) => (
                <PaymentRowSkeleton key={i} />
              ))}
            </ul>
          ) : paymentBreakdown.length > 0 ? (
            <ul className="divide-y divide-border">
              {paymentBreakdown.map((item) => {
                const meta = METHOD_META[item.method] ?? { label: item.method, icon: Wallet };
                const Icon = meta.icon;
                const isCredit = item.method === "credit";
                const pct = !isCredit && grandTotal > 0 ? (item.total / grandTotal) * 100 : 0;

                return (
                  <li key={item.method} className="py-3">
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center shrink-0"
                          aria-hidden="true"
                        >
                          <Icon className="h-4 w-4" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{meta.label}</p>
                          <p className="text-xs text-muted-foreground tabular-nums">
                            {caption(item)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium text-foreground font-mono tabular-nums whitespace-nowrap">
                          {formatCurrency(item.total)}
                        </p>
                        {isCredit ? (
                          <p
                            className="text-xs text-muted-foreground"
                            title="No forma parte del total cobrado"
                          >
                            <span aria-hidden="true">—</span>
                            <span className="sr-only">Sin porcentaje: no forma parte del total cobrado</span>
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground font-mono tabular-nums">
                            {pct.toFixed(1)}% <span className="sr-only">del total cobrado</span>
                          </p>
                        )}
                      </div>
                    </div>
                    {/* La barra duplica el porcentaje visible: decorativa para lectores de pantalla */}
                    {!isCredit && (
                      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden" aria-hidden="true">
                        <div
                          className="h-full bg-primary rounded-full transition-[width] duration-500 motion-reduce:transition-none"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center" role="status">
              <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-3" aria-hidden="true">
                <Wallet className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">Sin pagos registrados</p>
              <p className="text-xs text-muted-foreground">No se registraron ventas en el período seleccionado.</p>
            </div>
          )}
        </div>
      </section>
    );
  },
);
