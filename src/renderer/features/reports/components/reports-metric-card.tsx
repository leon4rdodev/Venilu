import { cn } from "@lib/utils";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ReportsMetricCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  change?: string;
  index?: number;
}

const TREND_META = {
  up: {
    Icon: TrendingUp,
    text: "favorable",
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  down: {
    Icon: TrendingDown,
    text: "desfavorable",
    className: "bg-destructive/10 text-destructive",
  },
  neutral: {
    Icon: Minus,
    text: "sin cambio",
    className: "bg-muted text-muted-foreground",
  },
} as const;

/**
 * Compact Vercel-style stat card: circular icon top-left, optional trend
 * pill top-right, value + label below. Flat, bordered, subtle hover.
 * La tendencia se comunica con icono + texto + color (nunca solo color).
 */
export function ReportsMetricCard({
  label,
  value,
  icon: Icon,
  trend,
  change,
}: ReportsMetricCardProps) {
  const trendMeta = trend ? TREND_META[trend] : null;
  const trendHint = trendMeta ? `respecto al período anterior, tendencia ${trendMeta.text}` : "";

  return (
    <div className="h-full">
      <div
        role="group"
        aria-label={`${label}: ${value}`}
        className="bg-card border border-border rounded-lg p-4 flex flex-col justify-between gap-4 h-full transition-[border-color,box-shadow] duration-200 hover:shadow-sm hover:border-foreground/20"
      >
        <div className="flex justify-between items-start gap-2">
          <div className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center shrink-0" aria-hidden="true">
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </div>
          {change && trendMeta && (
            <div
              title={`${change} ${trendHint}`}
              className={cn(
                "flex items-center gap-1 text-xs font-medium px-2 h-6 rounded-full tabular-nums whitespace-nowrap",
                trendMeta.className
              )}
            >
              <trendMeta.Icon className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden="true" />
              <span>{change}</span>
              <span className="sr-only"> {trendHint}</span>
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="text-xl font-semibold tracking-tight tabular-nums truncate text-foreground" title={String(value)}>
            {value}
          </div>
          <div className="text-xs font-medium mt-1 truncate text-muted-foreground" title={label}>
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}
