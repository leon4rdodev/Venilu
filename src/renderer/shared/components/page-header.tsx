import React from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

/**
 * Static page header — the page ENTRANCE animation lives exclusively in
 * AnimatedPage, so headers never animate on their own (no side-slides).
 */
export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tighter text-foreground text-balance">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground text-sm max-w-2xl text-balance">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="flex shrink-0 items-center gap-2">
          {action}
        </div>
      )}
    </div>
  );
}
