import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@components/ui/card";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatCurrency } from "@lib/currency";
import { BarChart3, TrendingUp } from "lucide-react";

const compactCurrency = (value: number) => {
  if (value >= 1_000_000) return `RD$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `RD$${(value / 1_000).toFixed(1)}K`;
  return `RD$${value}`;
};

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
      <Card className="border-border/50 shadow-sm bg-card transition-shadow duration-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <BarChart3 className="h-5 w-5" />
            </div>
            <span>Ventas en el Tiempo</span>
          </CardTitle>
          <CardDescription>
            Resumen de ingresos y transacciones agrupado por{" "}
            {interval === "week"
              ? "semana"
              : interval === "month"
                ? "mes"
                : "día"}
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="pl-0 pr-4 pb-4">
          <div className="h-[300px] w-full">
            {loading ? (
              <div className="w-full h-full flex items-end gap-2 p-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-muted/20 animate-pulse rounded-t-lg"
                    style={{ height: `${Math.random() * 60 + 20}%` }}
                  />
                ))}
              </div>
            ) : salesOverTime.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={salesOverTime}
                  margin={{ top: 20, right: 30, left: 20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    className="stroke-muted"
                  />
                  <XAxis
                    dataKey="period"
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    tickFormatter={formatPeriodLabel}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => compactCurrency(value)}
                    tickMargin={10}
                    width={75}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)" }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-xl border border-border bg-background/95 backdrop-blur-sm p-3 shadow-lg ring-1 ring-black/5">
                            <div className="flex flex-col gap-1">
                              <span className="text-[0.70rem] uppercase text-muted-foreground font-semibold tracking-wider">
                                Período
                              </span>
                              <span className="font-bold text-foreground">
                                {payload[0].payload.period}
                              </span>
                              <div className="h-px bg-border my-1" />
                              <div className="flex items-center gap-2">
                                <TrendingUp className="h-3 w-3 text-green-500" />
                                <span className="font-bold text-primary">
                                  {formatCurrency(
                                    payload[0].payload.totalSales,
                                  )}{" "}
                                  <span className="text-muted-foreground font-normal text-xs">
                                    en ventas
                                  </span>
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {payload[0].payload.totalTransactions}{" "}
                                  transacciones
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
                    dataKey="totalSales"
                    fill="var(--primary)"
                    radius={[6, 6, 0, 0]}
                    barSize={40}
                    className="fill-primary"
                    animationDuration={1500}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <BarChart3 className="h-10 w-10 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium mb-1">
                  No hay datos de ventas
                </p>
                <p className="text-xs text-muted-foreground">
                  Selecciona un período con ventas registradas
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  },
);
