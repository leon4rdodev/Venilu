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
  const hasAny = visible.some((t) => t.total > 0);

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <WidgetHeader icon={Wallet} title="Métodos de Pago" subtitle="Distribución de ingresos hoy" />

      <div className="mt-6 space-y-5">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2 animate-pulse">
              <div className="flex justify-between">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-4 w-20 bg-muted rounded" />
              </div>
              <div className="h-1 w-full bg-muted rounded-full" />
            </div>
          ))
        ) : !hasAny ? (
          <p className="text-sm text-muted-foreground text-center py-4">Sin ingresos registrados hoy.</p>
        ) : (
          visible.map(({ key, label, icon: Icon, total }) => (
            <div key={key} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm min-w-0">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.75} />
                  <span className="font-medium truncate">{label}</span>
                </div>
                <span className="text-sm font-semibold tabular-nums whitespace-nowrap">
                  {formatCurrency(total)}
                </span>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${(total / max) * 100}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
