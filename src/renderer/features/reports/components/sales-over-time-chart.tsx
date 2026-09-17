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

const INTERVAL_LABEL: Record<"day" | "week" | "month", string> = {
  day: "día",
  week: "semana",
  month: "mes",
};

interface SalesOverTimeChartProps {
  salesOverTime: SalesOverTimeData[];
  loading: boolean;
  interval?: "day" | "week" | "month";
}

/** Deterministic pseudo-random bar heights so the skeleton doesn't jitter between renders. */
const SKELETON_HEIGHTS = [42, 68, 35, 76, 52, 61, 30, 80, 47, 58, 38, 71];

/** Quita el ".0" de los compactos ("1.0K" → "1K") para ticks más limpios. */
const trimZero = (n: string) => n.replace(/\.0$/, "");

export const SalesOverTimeChart = React.memo(
  ({ salesOverTime, loading, interval = "day" }: SalesOverTimeChartProps) => {
    // Re-render when currency changes so the Y-axis symbol updates
    const { currency } = useCurrency();
    const [metric, setMetric] = useState<ChartMetric>("totalSales");

    const activeOption = METRIC_OPTIONS.find((o) => o.value === metric) ?? METRIC_OPTIONS[0];

    const compactCurrency = (value: number) => {
      const sym = getCurrencySymbol(currency);
      if (value >= 1_000_000) return `${sym}${trimZero((value / 1_000_000).toFixed(1))}M`;
      if (value >= 1_000) return `${sym}${trimZero((value / 1_000).toFixed(1))}K`;
      return `${sym}${Math.round(value).toLocaleString("es-DO")}`;
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

    const chartDescription = `Gráfica de barras de ${activeOption.label.toLowerCase()} por ${INTERVAL_LABEL[interval]}, ${salesOverTime.length} ${
      salesOverTime.length === 1 ? "período" : "períodos"
    }.`;

    return (
      <section className="bg-card border border-border rounded-lg p-6" aria-label="Ventas en el tiempo">
        <WidgetHeader
          icon={BarChart3}
          title="Ventas en el Tiempo"
          subtitle={`Resumen agrupado por ${INTERVAL_LABEL[interval]}.`}
          action={
            // Control segmentado: actúa como leyenda de la serie visible
            <div
              role="group"
              aria-label="Métrica de la gráfica"
              className="flex items-center gap-1 bg-muted rounded-full p-1 shrink-0"
            >
              {METRIC_OPTIONS.map((option) => {
                const isActive = metric === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setMetric(option.value)}
                    className={cn(
                      "px-3 h-7 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
                      "outline-none focus-visible:ring-[1px] focus-visible:ring-ring",
                      isActive
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          }
        />

        <div className="h-[300px] w-full mt-6" aria-busy={loading}>
          {loading ? (
            <div className="w-full h-full flex items-end gap-2 p-4" aria-hidden="true">
              {SKELETON_HEIGHTS.map((height, i) => (
                <div
                  key={i}
                  className="flex-1 bg-muted animate-pulse rounded-t"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          ) : salesOverTime.length > 0 ? (
            <div role="img" aria-label={chartDescription} className="h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={salesOverTime}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  {/* Tokens vía CSS vars: la rejilla y los ejes siguen el tema claro/oscuro */}
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--border)"
                  />
                  <XAxis
                    dataKey="period"
                    stroke="var(--muted-foreground)"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    tickFormatter={formatPeriodLabel}
                    minTickGap={16}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={yTickFormatter}
                    tickMargin={8}
                    width={64}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const p = payload[0].payload as SalesOverTimeData;
                        const rows: { key: ChartMetric; label: string; value: string }[] = [
                          { key: "totalSales", label: "Ingresos", value: formatCurrency(p.totalSales) },
                          { key: "totalProfit", label: "Ganancia", value: formatCurrency(p.totalProfit ?? 0) },
                          { key: "totalTransactions", label: "Transacciones", value: p.totalTransactions.toLocaleString("es-DO") },
                        ];
                        return (
                          <div className="rounded-lg border border-border bg-popover text-popover-foreground p-3 shadow-md">
                            <p className="text-xs font-semibold text-foreground mb-2">
                              {formatPeriodLabel(p.period)}
                            </p>
                            <dl className="space-y-1">
                              {rows.map((row) => (
                                <div key={row.key} className="flex items-center justify-between gap-6">
                                  <dt className={cn("text-xs", metric === row.key ? "text-foreground" : "text-muted-foreground")}>
                                    {row.label}
                                  </dt>
                                  <dd className={cn("text-xs font-mono tabular-nums", metric === row.key ? "font-semibold text-foreground" : "font-medium text-muted-foreground")}>
                                    {row.value}
                                  </dd>
                                </div>
                              ))}
                            </dl>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey={metric}
                    name={activeOption.label}
                    fill="var(--chart-1)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center" role="status">
              <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-3" aria-hidden="true">
                <BarChart3 className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">
                No hay datos de ventas
              </p>
              <p className="text-xs text-muted-foreground">
                Selecciona un período con ventas registradas.
              </p>
            </div>
          )}
        </div>
      </section>
    );
  },
);
