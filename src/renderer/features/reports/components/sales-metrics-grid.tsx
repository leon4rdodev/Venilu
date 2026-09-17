
import React from 'react';
import { TrendingUp, DollarSign, Wallet, Percent, Receipt, Coins, ShoppingBag, LucideIcon } from "lucide-react"
import { ReportsMetricCard } from './reports-metric-card';
import { formatCurrency } from '@lib/currency';

interface SalesMetric {
  label: string;
  value: number;
  change: string;
  trend: 'up' | 'down' | 'neutral';
}

interface SalesMetricsGridProps {
  salesMetrics: SalesMetric[];
  loading: boolean;
}

const ICONS: Record<string, LucideIcon> = {
  "Total Ventas": DollarSign,
  "Ganancia Neta": TrendingUp,
  "Costo Total": Wallet,
  "Margen Promedio": Percent,
  "Transacciones": Receipt,
  "Ticket Promedio": Coins,
  "Unidades Vendidas": ShoppingBag,
};

/** Labels whose value is a plain count (not money). */
const COUNT_LABELS = new Set(["Transacciones", "Unidades Vendidas"]);

export const SalesMetricsGrid = React.memo(({ salesMetrics, loading }: SalesMetricsGridProps) => {
  const formatValue = (metric: SalesMetric): string => {
    if (metric.label === "Margen Promedio") return `${metric.value.toFixed(2)}%`;
    if (COUNT_LABELS.has(metric.label)) return metric.value.toLocaleString("es-DO");
    return formatCurrency(metric.value);
  };

  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4"
      aria-busy={loading}
      aria-label="Métricas del período"
    >
      {loading ? (
        // Skeleton con las mismas dimensiones que la tarjeta real para evitar saltos de layout
        Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            aria-hidden="true"
            className="bg-card border border-border rounded-lg p-4 flex flex-col justify-between gap-4 h-full animate-pulse"
          >
            <div className="flex justify-between items-start">
              <div className="w-8 h-8 rounded-full bg-muted" />
              <div className="h-6 w-14 rounded-full bg-muted" />
            </div>
            <div className="space-y-2">
              <div className="h-6 w-20 bg-muted rounded" />
              <div className="h-3 w-24 bg-muted rounded" />
            </div>
          </div>
        ))
      ) : (
        salesMetrics.map((metric, index) => (
          <ReportsMetricCard
            key={metric.label}
            label={metric.label}
            value={formatValue(metric)}
            icon={ICONS[metric.label] ?? DollarSign}
            trend={metric.trend}
            change={metric.change}
            index={index}
          />
        ))
      )}
    </div>
  );
});
