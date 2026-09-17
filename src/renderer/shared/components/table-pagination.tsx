import { Button } from "@components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface TablePaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

/**
 * Standard list-footer pagination used across Inventory and Customers:
 * "Mostrando X–Y de Z" on the left, chevrons + "page / total" on the right.
 * Renders nothing with a single page (no dead space).
 */
export function TablePagination({ page, totalPages, pageSize, totalItems, onPageChange }: TablePaginationProps) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);

  return (
    <nav
      aria-label="Paginación"
      className="flex items-center justify-between gap-4 pt-1"
    >
      <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
        Mostrando {from}–{to} de {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Button>
        <span className="text-sm font-medium tabular-nums min-w-[3.5rem] text-center" aria-current="page">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Página siguiente"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
