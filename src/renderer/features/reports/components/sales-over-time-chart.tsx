import React from "react";
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

interface SalesOverTimeData {
  period: string;
  totalSales: number;
  totalTransactions: number;
}

interface SalesOverTimeChartProps {
  salesOverTime: SalesOverTimeData[];
  loading: boolean;
  interval?: "day" | "week" | "month";
}

export const SalesOverTimeChart = React.memo(
  ({ salesOverTime, loading, interval = "day" }: SalesOverTimeChartProps) => {
    // Re-render when currency changes so the Y-axis symbol updates
    const { currency } = useCurrency();

    const compactCurrency = (value: number) => {
      const sym = getCurrencySymbol(currency);
      if (value >= 1_000_000) return `${sym}${(value / 1_000_000).toFixed(1)}M`;
      if (value >= 1_000) return `${sym}${(value / 1_000).toFixed(1)}K`;
      return `${sym}${value}`;
    };

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
          subtitle={`Resumen de ingresos y transacciones agrupado por ${
            interval === "week" ? "semana" : interval === "month" ? "mes" : "día"
          }.`}
        />

        <div className="h-[300px] w-full mt-6">
          {loading ? (
            <div className="w-full h-full flex items-end gap-2 p-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 bg-muted animate-pulse rounded-t"
                  style={{ height: `${Math.random() * 60 + 20}%` }}
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
                  tickFormatter={(value) => compactCurrency(value)}
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
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                            {formatPeriodLabel(p.period)}
                          </p>
                          <p className="text-sm font-semibold tabular-nums">
                            {formatCurrency(p.totalSales)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {p.totalTransactions} transacci
                            {p.totalTransactions === 1 ? "ón" : "ones"}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="totalSales"
                  fill="var(--primary)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                  animationDuration={800}
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
