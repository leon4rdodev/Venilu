import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@components/ui/card";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Package, TrendingUp, BarChart3 } from "lucide-react";
import type { TopProduct } from "@renderer/features/dashboard/types";

interface TopProductsChartProps {
  data: TopProduct[];
}

export function TopProductsChart({ data }: TopProductsChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card className="col-span-1 md:col-span-2 lg:col-span-2 border-border/50 shadow-sm bg-card transition-shadow duration-300">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Package className="h-5 w-5" />
            </div>
            <span>Productos Más Vendidos</span>
          </CardTitle>
          <CardDescription>
            Los productos con mayor rotación en el dia
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full flex flex-col items-center justify-center text-center">
            <div className="p-4 bg-muted/30 rounded-full mb-4">
              <BarChart3 className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground font-medium">Sin ventas aún</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Los productos más vendidos aparecerán aquí cuando se registren ventas.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-1 md:col-span-2 lg:col-span-2 border-border/50 shadow-sm bg-card transition-shadow duration-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg text-primary">
            <Package className="h-5 w-5" />
          </div>
          <span>Productos Más Vendidos</span>
        </CardTitle>
        <CardDescription>
          Los productos con mayor rotación en el dia
        </CardDescription>
      </CardHeader>
      <CardContent className="pl-0 pr-4 pb-4">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
              <XAxis
                dataKey="productName"
                stroke="var(--muted-foreground)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                tickFormatter={(value) => value.length > 10 ? `${value.slice(0, 10)}...` : value}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}`}
                tickMargin={10}
              />
              <Tooltip
                cursor={{ fill: 'var(--muted)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-xl border border-border bg-background/95 backdrop-blur-sm p-3 shadow-lg ring-1 ring-black/5">
                        <div className="flex flex-col gap-1">
                          <span className="text-[0.70rem] uppercase text-muted-foreground font-semibold tracking-wider">
                            Producto
                          </span>
                          <span className="font-bold text-foreground">
                            {payload[0].payload.productName}
                          </span>
                          <div className="h-px bg-border my-1" />
                          <div className="flex items-center gap-2">
                             <TrendingUp className="h-3 w-3 text-green-500" />
                             <span className="font-bold text-primary">
                              {payload[0].value} <span className="text-muted-foreground font-normal text-xs">vendidos</span>
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Bar
                dataKey="totalSold"
                fill="var(--primary)"
                radius={[6, 6, 0, 0]}
                barSize={40}
                className="fill-primary"
                animationDuration={1500}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
