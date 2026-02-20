import { type LucideIcon } from "lucide-react";
import { TableRow, TableCell } from "@components/ui/table";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  colSpan?: number;
}

/**
 * EmptyState as a standalone block (for non-table contexts)
 */
export function EmptyState({ icon: Icon, title, description }: Omit<EmptyStateProps, "colSpan">) {
  return (
    <div className="flex flex-col items-center justify-center text-muted-foreground py-12 text-center">
      <Icon className="h-10 w-10 mb-2 opacity-30" />
      <p className="font-medium">{title}</p>
      {description && <p className="text-xs mt-1">{description}</p>}
    </div>
  );
}

/**
 * EmptyStateRow for use inside a <TableBody>
 */
export function EmptyStateRow({ icon: Icon, title, description, colSpan = 5 }: EmptyStateProps) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="h-32 text-center">
        <div className="flex flex-col items-center justify-center text-muted-foreground">
          <Icon className="h-10 w-10 mb-2 opacity-30" />
          <p className="font-medium">{title}</p>
          {description && <p className="text-xs mt-1">{description}</p>}
        </div>
      </TableCell>
    </TableRow>
  );
}
