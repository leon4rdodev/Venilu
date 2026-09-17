import { cn } from "@lib/utils";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Skeleton } from "@renderer/shared/components/ui/skeleton";

interface InventoryMetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  change?: string;
  index?: number;
  isLoading?: boolean;
}

/** Compact Vercel-style stat card (same pattern as the dashboard). */
export function InventoryMetricCard({
  title,
  value,
  icon: Icon,
  trend,
  change,
  isLoading,
}: InventoryMetricCardProps) {
  return (
    <div className="h-full">
      <div className="bg-card border border-border rounded-lg p-4 flex flex-col justify-between gap-3 h-full transition-all duration-200 hover:shadow-sm hover:border-foreground/20">
        <div className="flex justify-between items-start">
          <div className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center shrink-0" aria-hidden="true">
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </div>
          {isLoading ? (
            <Skeleton className="h-5 w-14 rounded-full" />
          ) : (
            change && (
              <div
                className={cn(
                  "flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap",
                  trend === "up"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : trend === "down"
                      ? "bg-red-500/10 text-red-600 dark:text-red-400"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {trend === "up" && <TrendingUp className="h-3 w-3" aria-hidden="true" />}
                {trend === "down" && <TrendingDown className="h-3 w-3" aria-hidden="true" />}
                {trend === "neutral" && <Minus className="h-3 w-3" aria-hidden="true" />}
                <span>{change}</span>
              </div>
            )
          )}
        </div>

        {/* Etiqueta primero en el DOM (lectores de pantalla), valor arriba visualmente */}
        <div className="min-w-0 flex flex-col-reverse">
          <div className="text-xs font-medium mt-0.5 text-muted-foreground truncate" title={title}>
            {title}
          </div>
          {isLoading ? (
            <Skeleton className="h-7 w-24 mb-1" />
          ) : (
            <div className="text-xl font-semibold tracking-tight tabular-nums truncate" title={String(value)}>
              {value}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
