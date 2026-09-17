import { cn } from "@lib/utils";
import { Skeleton } from "@components/ui/skeleton";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface CustomerMetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  change?: string;
  index?: number;
  /** Muestra un placeholder en lugar del valor mientras cargan los datos. */
  loading?: boolean;
}

/**
 * Compact Vercel-style stat card (mirrors dashboard/metric-card):
 * circular icon top-left, optional trend badge top-right, value + label below.
 *
 * Accessibility: the trend badge always carries text (never color alone) and
 * the icon is decorative; the whole card reads as "<title>: <value>".
 */
export function CustomerMetricCard({
  title,
  value,
  icon: Icon,
  trend,
  change,
  loading = false,
}: CustomerMetricCardProps) {
  const trendClass =
    trend === "up"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
      : trend === "down"
      ? "bg-red-500/10 text-red-700 dark:text-red-400"
      : "bg-muted text-muted-foreground";

  return (
    <div className="h-full">
      <div
        className="bg-card border border-border rounded-lg p-4 flex flex-col justify-between gap-3 h-full transition-[border-color,box-shadow] duration-200 hover:border-foreground/20 hover:shadow-sm"
        role="group"
        aria-label={loading ? `${title}: cargando` : `${title}: ${value}`}
        aria-busy={loading || undefined}
      >
        <div className="flex justify-between items-start gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center bg-muted text-foreground shrink-0"
            aria-hidden="true"
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </div>
          {change && !loading && (
            <div
              className={cn(
                "flex items-center gap-1 text-[11px] leading-none font-medium px-2 py-1 rounded-full whitespace-nowrap min-w-0",
                trendClass
              )}
              title={change}
            >
              {trend === "up" && <TrendingUp className="h-3 w-3 shrink-0" aria-hidden="true" />}
              {trend === "down" && <TrendingDown className="h-3 w-3 shrink-0" aria-hidden="true" />}
              {trend === "neutral" && <Minus className="h-3 w-3 shrink-0" aria-hidden="true" />}
              <span className="truncate">{change}</span>
            </div>
          )}
        </div>

        <div className="min-w-0">
          {loading ? (
            <Skeleton className="h-6 w-20 mb-1" />
          ) : (
            <div
              className="text-xl leading-7 font-semibold tracking-tight tabular-nums text-foreground truncate"
              title={String(value)}
            >
              {value}
            </div>
          )}
          <div className="text-xs leading-4 font-medium text-muted-foreground mt-0.5 truncate" title={title}>
            {title}
          </div>
        </div>
      </div>
    </div>
  );
}
