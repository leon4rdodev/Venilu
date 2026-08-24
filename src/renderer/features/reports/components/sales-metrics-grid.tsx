
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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
      {loading ? (
        Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-[118px] bg-card border border-border rounded-lg p-4 animate-pulse" />
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
