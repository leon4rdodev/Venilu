import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@lib/utils";

interface WidgetHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  /** Right-aligned slot (selector, link, button) */
  action?: ReactNode;
  /** Red tint for alert-type widgets */
  danger?: boolean;
  className?: string;
}

/**
 * Vercel-style section header used across the app:
 * small circular icon container + tight semibold title + muted subtitle.
 */
export function WidgetHeader({ icon: Icon, title, subtitle, action, danger = false, className }: WidgetHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
              danger ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground"
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} />
          </div>
          <h2 className="text-base font-semibold tracking-tight truncate">{title}</h2>
        </div>
        {subtitle && <p className="text-sm text-muted-foreground mt-1 ml-[42px]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
