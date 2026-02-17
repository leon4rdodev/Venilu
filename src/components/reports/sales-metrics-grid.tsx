
import React from 'react';
import { TrendingUp, DollarSign, Wallet, Percent, LucideIcon } from "lucide-react"
import { ReportsMetricCard } from './reports-metric-card';

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

export const SalesMetricsGrid = React.memo(({ salesMetrics, loading }: SalesMetricsGridProps) => {
  const getIconForLabel = (label: string): LucideIcon => {
    switch (label) {
      case "Total Ventas":
        return DollarSign;
      case "Ganancia Neta":
        return TrendingUp;
      case "Costo Total":
        return Wallet;
      case "Margen Promedio":
        return Percent;
      default:
        return DollarSign;
    }
  };

  return (
    <div
      className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
    >
      {loading ? (
         Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-muted/20 animate-pulse rounded-xl border border-muted/20" />
          ))
      ) : (
        salesMetrics.map((metric, index) => {
          const Icon = getIconForLabel(metric.label);
          const isPercentage = metric.label === "Margen Promedio";
          const formattedValue = isPercentage 
            ? `${metric.value.toFixed(2)}%` 
            : new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(metric.value);

          return (
            <ReportsMetricCard
              key={metric.label}
              label={metric.label}
              value={formattedValue}
              icon={Icon}
              trend={metric.trend}
              change={metric.change}
              index={index}
            />
          );
        })
      )}
    </div>
  );
});
