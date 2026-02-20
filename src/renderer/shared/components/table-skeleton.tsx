import { TableRow, TableCell } from "@components/ui/table";

interface TableSkeletonProps {
  rows?: number;
  cols?: number;
}

/**
 * Renders animated skeleton rows inside a <TableBody>
 */
export function TableSkeletonRows({ rows = 5, cols = 5 }: TableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRow key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <TableCell key={j}>
              <div
                className="h-5 bg-muted/30 animate-pulse rounded"
                style={{ width: `${60 + (j * 20) % 60}px` }}
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
