import { useMemo } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { BarChart3 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import { WidgetHeader } from "@renderer/shared/components/widget-header";
import { formatCurrency } from "@lib/currency";
import type { HourlySalesPoint } from "@renderer/features/dashboard/types";

interface SalesByHourChartProps {
  data: HourlySalesPoint[];
  day: "today" | "yesterday";
  onDayChange: (day: "today" | "yesterday") => void;
}

const formatHour = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`;

export function SalesByHourChart({ data, day, onDayChange }: SalesByHourChartProps) {
  // Fill the business-hours range (8am–8pm by default, expanded to include
  // any sale outside it) so quiet hours still show as empty slots.
  const series = useMemo(() => {
    const byHour = new Map(data.map((d) => [d.hour, d]));
    let minH = 8;
    let maxH = 20;
    for (const d of data) {
      if (d.hour < minH) minH = d.hour;
      if (d.hour > maxH) maxH = d.hour;
    }
    const points = [];
    for (let h = minH; h <= maxH; h++) {
      const entry = byHour.get(h);
      points.push({
        hour: h,
        label: formatHour(h),
        total: entry?.total ?? 0,
        transactions: entry?.transactions ?? 0,
      });
    }
    return points;
  }, [data]);

  const maxTotal = useMemo(() => Math.max(...series.map((p) => p.total), 0), [series]);
  const hasSales = maxTotal > 0;

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <WidgetHeader
        icon={BarChart3}
        title="Ventas por Hora"
        subtitle={`Flujo de transacciones durante ${day === "today" ? "el día actual" : "el día de ayer"}`}
        action={
          <Select value={day} onValueChange={(v) => onDayChange(v as "today" | "yesterday")}>
            <SelectTrigger className="w-[100px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="yesterday">Ayer</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <div className="h-[280px] w-full mt-6">
        {!hasSales ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-3">
              <BarChart3 className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              Sin ventas registradas {day === "today" ? "hoy" : "ayer"}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
              <XAxis
                dataKey="label"
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickMargin={10}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={44}
                tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`)}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const p = payload[0].payload as (typeof series)[number];
                    return (
                      <div className="rounded-lg border border-border bg-popover p-3 shadow-md">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                          {p.label}
                        </p>
                        <p className="text-sm font-semibold tabular-nums">{formatCurrency(p.total)}</p>
                        <p className="text-xs text-muted-foreground">
                          {p.transactions} transacci{p.transactions === 1 ? "ón" : "ones"}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
                {series.map((p) => (
                  // Peak hour rendered in solid black (primary); the rest muted
                  <Cell key={p.hour} fill={p.total === maxTotal ? "var(--primary)" : "var(--muted)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
