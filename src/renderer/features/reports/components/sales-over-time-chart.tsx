import React, { useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatCurrency, getCurrencySymbol } from "@lib/currency";
import { useCurrency } from "@renderer/shared/context/currency-context";
import { BarChart3 } from "lucide-react";
import { WidgetHeader } from "@renderer/shared/components/widget-header";
import { cn } from "@lib/utils";
import type { SalesOverTimeData } from "../hooks/use-reports";

type ChartMetric = "totalSales" | "totalProfit" | "totalTransactions";

const METRIC_OPTIONS: { value: ChartMetric; label: string; isCurrency: boolean }[] = [
  { value: "totalSales", label: "Ingresos", isCurrency: true },
  { value: "totalProfit", label: "Ganancia", isCurrency: true },
  { value: "totalTransactions", label: "Transacciones", isCurrency: false },
];

interface SalesOverTimeChartProps {
  salesOverTime: SalesOverTimeData[];
  loading: boolean;
  interval?: "day" | "week" | "month";
}

/** Deterministic pseudo-random bar heights so the skeleton doesn't jitter between renders. */
const SKELETON_HEIGHTS = [42, 68, 35, 76, 52, 61, 30, 80, 47, 58, 38, 71];

export const SalesOverTimeChart = React.memo(
  ({ salesOverTime, loading, interval = "day" }: SalesOverTimeChartProps) => {
    // Re-render when currency changes so the Y-axis symbol updates
    const { currency } = useCurrency();
    const [metric, setMetric] = useState<ChartMetric>("totalSales");

    const activeOption = METRIC_OPTIONS.find((o) => o.value === metric) ?? METRIC_OPTIONS[0];

    const compactCurrency = (value: number) => {
      const sym = getCurrencySymbol(currency);
      if (value >= 1_000_000) return `${sym}${(value / 1_000_000).toFixed(1)}M`;
      if (value >= 1_000) return `${sym}${(value / 1_000).toFixed(1)}K`;
      return `${sym}${value}`;
    };

    const yTickFormatter = (value: number) =>
      activeOption.isCurrency ? compactCurrency(value) : Math.round(value).toLocaleString("es-DO");

    const formatPeriodLabel = (value: string) => {
      // Check format: YYYY-W## (Week)
      if (value.includes("-W")) {
        const weekNum = value.split("-W")[1];
        return `Sem ${weekNum}`;
      }
      // Check format: YYYY-MM (Month) - length 7
      if (value.length === 7) {
        const date = new Date(value + "-01");
        return date.toLocaleDateString("es-DO", {
          month: "short",
          year: "numeric",
        });
      }
      // Default: YYYY-MM-DD (Day) - Parse components manually to avoid UTC timezone shift (off-by-one error)
      const [year, month, day] = value.split("-").map(Number);
      // Note: Month is 0-indexed in Date constructor
      const date = new Date(year, month - 1, day);

      // If invalid date, return original value
      if (isNaN(date.getTime())) return value;

      return date.toLocaleDateString("es-DO", {
        day: "2-digit",
        month: "short",
      });
    };

    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <WidgetHeader
          icon={BarChart3}
          title="Ventas en el Tiempo"
          subtitle={`Resumen agrupado por ${
            interval === "week" ? "semana" : interval === "month" ? "mes" : "día"
          }.`}
          action={
            <div className="flex items-center gap-1 bg-muted rounded-full p-1 shrink-0">
              {METRIC_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setMetric(option.value)}
                  className={cn(
                    "px-3 h-7 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                    metric === option.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          }
        />

        <div className="h-[300px] w-full mt-6">
          {loading ? (
            <div className="w-full h-full flex items-end gap-2 p-4">
              {SKELETON_HEIGHTS.map((height, i) => (
                <div
                  key={i}
                  className="flex-1 bg-muted animate-pulse rounded-t"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          ) : salesOverTime.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={salesOverTime}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  className="stroke-border"
                />
                <XAxis
                  dataKey="period"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  tickFormatter={formatPeriodLabel}
                />
                <YAxis
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={yTickFormatter}
                  tickMargin={8}
                  width={60}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const p = payload[0].payload as SalesOverTimeData;
                      return (
                        <div className="rounded-lg border border-border bg-popover p-3 shadow-md">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                            {formatPeriodLabel(p.period)}
                          </p>
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-between gap-6">
                              <span className="text-xs text-muted-foreground">Ingresos</span>
                              <span className={cn("text-xs font-mono tabular-nums", metric === "totalSales" ? "font-semibold" : "font-medium")}>
                                {formatCurrency(p.totalSales)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-6">
                              <span className="text-xs text-muted-foreground">Ganancia</span>
                              <span className={cn("text-xs font-mono tabular-nums", metric === "totalProfit" ? "font-semibold" : "font-medium")}>
                                {formatCurrency(p.totalProfit ?? 0)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-6">
                              <span className="text-xs text-muted-foreground">Transacciones</span>
                              <span className={cn("text-xs font-mono tabular-nums", metric === "totalTransactions" ? "font-semibold" : "font-medium")}>
                                {p.totalTransactions}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey={metric}
                  fill="var(--primary)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                <BarChart3 className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                No hay datos de ventas
              </p>
              <p className="text-xs text-muted-foreground">
                Selecciona un período con ventas registradas
              </p>
            </div>
          )}
        </div>
      </div>
    );
  },
);
