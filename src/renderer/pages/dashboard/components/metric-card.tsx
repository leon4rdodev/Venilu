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
 * badge top-right, value + label below. Flat, bordered, non-interactive.
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
  const showTrend = Boolean(change && trend && trend !== "neutral");

  return (
    <div
      className={cn(
        "bg-card border rounded-lg p-4 flex flex-col justify-between gap-3 h-full",
        danger ? "border-destructive/30" : "border-border"
      )}
    >
      <div className="flex justify-between items-start gap-2">
        <div
          aria-hidden="true"
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
            danger ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground"
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </div>
        {showTrend && (
          <div
            title="Comparado con ayer"
            aria-label={`${change} comparado con ayer`}
            className={cn(
              "flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full tabular-nums whitespace-nowrap",
              trend === "up"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-destructive/10 text-destructive"
            )}
          >
            {trend === "up" ? (
              <TrendingUp className="h-3 w-3" aria-hidden="true" />
            ) : (
              <TrendingDown className="h-3 w-3" aria-hidden="true" />
            )}
            <span>{change}</span>
          </div>
        )}
      </div>

      {/* dt before dd in DOM for screen readers ("Ventas de Hoy: RD$…"),
          reversed visually so the value stays on top. */}
      <dl className="min-w-0 flex flex-col-reverse gap-0.5">
        <dt className={cn("text-xs font-medium truncate", danger ? "text-destructive" : "text-muted-foreground")}>
          {title}
        </dt>
        <dd
          className={cn(
            "text-xl font-semibold tracking-tight tabular-nums truncate",
            danger ? "text-destructive" : "text-foreground"
          )}
          title={String(value)}
        >
          {value}
        </dd>
      </dl>
    </div>
  );
}

/** Placeholder with the exact same footprint as MetricCard, so content swaps in without a layout jump. */
export function MetricCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="bg-card border border-border rounded-lg p-4 flex flex-col justify-between gap-3 h-full animate-pulse"
    >
      <div className="w-8 h-8 rounded-full bg-muted" />
      <div className="space-y-1.5">
        <div className="h-6 w-3/4 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
      </div>
    </div>
  );
}
