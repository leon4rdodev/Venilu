import { Card, CardContent } from "@components/ui/card";
import { cn } from "@lib/utils";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { motion } from "framer-motion";
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

export function InventoryMetricCard({
  title,
  value,
  icon: Icon,
  trend,
  change,
  index = 0,
  isLoading,
}: InventoryMetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
      className="h-full"
    >
      <Card className="h-full overflow-hidden border border-border/50 shadow-sm hover:shadow-md transition-all duration-300 bg-card/50 backdrop-blur-sm group flex flex-col justify-between">
        <CardContent className="p-6 relative">
          <div className="flex items-center justify-between">
            <div className={cn(
              "p-2.5 rounded-xl transition-colors duration-300",
              "bg-primary/5 text-primary group-hover:bg-primary/10"
            )}>
              <Icon className="h-5 w-5" />
            </div>
            {change && !isLoading && (
              <div className={cn(
                "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border",
                trend === "up" 
                  ? "bg-green-500/10 text-green-600 border-green-200/50 dark:border-green-900/50" 
                  : trend === "down"
                  ? "bg-red-500/10 text-red-600 border-red-200/50 dark:border-red-900/50"
                  : "bg-muted text-muted-foreground border-border/50"
              )}>
                {trend === "up" && <TrendingUp className="h-3 w-3" />}
                {trend === "down" && <TrendingDown className="h-3 w-3" />}
                {trend === "neutral" && <Minus className="h-3 w-3" />}
                <span>{change}</span>
              </div>
            )}
            {isLoading && <Skeleton className="h-6 w-16 rounded-full" />}
          </div>
          
          <div className="mt-4">
            {isLoading ? (
              <Skeleton className="h-9 w-24 mb-1" />
            ) : (
              <h3 className="text-3xl font-bold tracking-tight text-foreground truncate" title={String(value)}>{value}</h3>
            )}
            <div className="flex items-center justify-between mt-1">
              <p className="text-sm font-medium text-muted-foreground truncate" title={title}>{title}</p>
            </div>
          </div>
          
          {/* Subtle background decoration */}
          <div className="absolute -right-4 -bottom-4 opacity-[0.03] pointer-events-none">
            <Icon className="h-24 w-24" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
