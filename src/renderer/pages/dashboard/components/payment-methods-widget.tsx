import { Banknote, CreditCard, Landmark, HandCoins, Wallet } from "lucide-react";
import { WidgetHeader } from "@renderer/shared/components/widget-header";
import { formatCurrency } from "@lib/currency";
import type { PaymentMethodTotal } from "@renderer/features/dashboard/types";

interface PaymentMethodsWidgetProps {
  data: PaymentMethodTotal[];
  loading: boolean;
}

const METHODS = [
  { key: "cash", label: "Efectivo", icon: Banknote },
  { key: "card", label: "Tarjeta", icon: CreditCard },
  { key: "transfer", label: "Transferencia", icon: Landmark },
  { key: "credit", label: "Crédito (pendiente)", icon: HandCoins },
] as const;

export function PaymentMethodsWidget({ data, loading }: PaymentMethodsWidgetProps) {
  const totals = METHODS.map((m) => ({
    ...m,
    total: data.find((d) => d.method === m.key)?.total ?? 0,
  }));
  // Credit only shows when used; the three base methods always render
  const visible = totals.filter((t) => t.key !== "credit" || t.total > 0);
  const max = Math.max(...visible.map((t) => t.total), 1);
  const sum = visible.reduce((acc, t) => acc + t.total, 0);
  const hasAny = sum > 0;

  return (
    <section aria-busy={loading} className="bg-card border border-border rounded-lg p-6">
      <WidgetHeader icon={Wallet} title="Métodos de Pago" subtitle="Distribución de ingresos hoy" />

      <div className="mt-6">
        {loading ? (
          <div aria-hidden="true" className="space-y-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2 animate-pulse">
                <div className="flex justify-between">
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-4 w-20 bg-muted rounded" />
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full" />
              </div>
            ))}
          </div>
        ) : !hasAny ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-3">
              <Wallet className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.5} aria-hidden="true" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Sin ingresos registrados hoy.</p>
          </div>
        ) : (
          <ul className="space-y-5">
            {visible.map(({ key, label, icon: Icon, total }) => {
              const share = Math.round((total / sum) * 100);
              return (
                <li key={key} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm min-w-0">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.75} aria-hidden="true" />
                      <span className="font-medium text-foreground truncate" title={label}>
                        {label}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground tabular-nums" aria-label={`${share} por ciento del total`}>
                        {share}%
                      </span>
                      <span className="text-sm font-semibold text-foreground tabular-nums whitespace-nowrap">
                        {formatCurrency(total)}
                      </span>
                    </div>
                  </div>
                  {/* Bar is relative to the largest method; the share is spelled out in text above */}
                  <div aria-hidden="true" className="h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-500 motion-reduce:transition-none"
                      style={{ width: `${(total / max) * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
