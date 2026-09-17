import { type LucideIcon } from "lucide-react";
import { TableRow, TableCell } from "@components/ui/table";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  colSpan?: number;
}

/** Shared body: circular muted icon well + foreground title + muted description. */
function EmptyStateBody({ icon: Icon, title, description }: Omit<EmptyStateProps, "colSpan">) {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <div
        aria-hidden
        className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
      >
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-xs text-sm text-muted-foreground text-balance">{description}</p>
      )}
    </div>
  );
}

/**
 * EmptyState as a standalone block (for non-table contexts)
 */
export function EmptyState({ icon, title, description }: Omit<EmptyStateProps, "colSpan">) {
  return (
    <div className="py-12">
      <EmptyStateBody icon={icon} title={title} description={description} />
    </div>
  );
}

/**
 * EmptyStateRow for use inside a <TableBody>
 */
export function EmptyStateRow({ icon, title, description, colSpan = 5 }: EmptyStateProps) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="h-40 text-center">
        <EmptyStateBody icon={icon} title={title} description={description} />
      </TableCell>
    </TableRow>
  );
}
