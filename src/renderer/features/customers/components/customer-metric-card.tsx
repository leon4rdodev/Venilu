import { cn } from "@lib/utils";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface CustomerMetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  change?: string;
  index?: number;
}

/**
 * Compact Vercel-style stat card (mirrors dashboard/metric-card):
 * circular icon top-left, optional trend badge top-right, value + label below.
 */
export function CustomerMetricCard({
  title,
  value,
  icon: Icon,
  trend,
  change,
}: CustomerMetricCardProps) {
  return (
    <div className="h-full">
      <div className="bg-card border border-border rounded-lg p-4 flex flex-col justify-between gap-3 h-full transition-all duration-200 hover:border-foreground/20 hover:shadow-sm">
        <div className="flex justify-between items-start">
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted text-foreground">
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </div>
          {change && (
            <div
              className={cn(
                "flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full",
                trend === "up"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : trend === "down"
                  ? "bg-red-500/10 text-red-600 dark:text-red-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {trend === "up" && <TrendingUp className="h-3 w-3" />}
              {trend === "down" && <TrendingDown className="h-3 w-3" />}
              {trend === "neutral" && <Minus className="h-3 w-3" />}
              <span>{change}</span>
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div
            className="text-xl font-semibold tracking-tight tabular-nums text-foreground truncate"
            title={String(value)}
          >
            {value}
          </div>
          <div className="text-xs font-medium text-muted-foreground mt-0.5 truncate" title={title}>
            {title}
          </div>
        </div>
      </div>
    </div>
  );
}
