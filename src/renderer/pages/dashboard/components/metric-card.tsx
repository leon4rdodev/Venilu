import { cn } from "@lib/utils";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";

export interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  change?: string;
  /** "danger" renders the red alert variant (e.g. stock alerts) */
  variant?: "default" | "danger";
  index?: number;
}

/**
 * Compact Vercel-style stat card: circular icon top-left, optional trend
 * badge top-right, value + label below. Flat, bordered, subtle hover.
 */
export function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  change,
  variant = "default",
}: MetricCardProps) {
  const danger = variant === "danger";

  return (
    <div className="h-full">
      <div
        className={cn(
          "bg-card border rounded-lg p-4 flex flex-col justify-between gap-3 h-full transition-all duration-200 hover:shadow-sm",
          danger ? "border-destructive/30 hover:border-destructive/50" : "border-border hover:border-foreground/20"
        )}
      >
        <div className="flex justify-between items-start">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center",
              danger ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground"
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </div>
          {change && trend && trend !== "neutral" && (
            <div
              className={cn(
                "flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full",
                trend === "up"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-red-500/10 text-red-600 dark:text-red-400"
              )}
            >
              {trend === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              <span>{change}</span>
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div
            className={cn(
              "text-xl font-semibold tracking-tight tabular-nums truncate",
              danger ? "text-destructive" : "text-foreground"
            )}
            title={String(value)}
          >
            {value}
          </div>
          <div className={cn("text-xs font-medium mt-0.5 truncate", danger ? "text-destructive" : "text-muted-foreground")}>
            {title}
          </div>
        </div>
      </div>
    </div>
  );
}
