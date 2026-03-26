
import { DateRangePicker } from "@components/ui/date-range-picker"
import { Button } from "@components/ui/button"
import { startOfDay, endOfDay, subMonths } from "date-fns"
import { useState } from "react"
import type { DateRange } from "react-day-picker"
import { FileDown, Loader2 } from "lucide-react"

interface ReportsHeaderProps {
  onDateRangeChange: (range: DateRange) => void;
  onGeneratePDF?: () => Promise<void>;
}

export function ReportsHeader({ onDateRangeChange, onGeneratePDF }: ReportsHeaderProps) {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subMonths(startOfDay(new Date()), 1), // 30 days ago
    to: endOfDay(new Date()), // Today
  });

  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);




  const handleDateSelect = (range: DateRange | undefined) => {
    if (range) {
      // Normalize dates to ensure proper day boundaries
      const normalizedRange = {
        from: range.from ? startOfDay(range.from) : undefined,
        to: range.to ? endOfDay(range.to) : undefined,
      };
      setDateRange(normalizedRange);
      onDateRangeChange(normalizedRange); // Directly call onDateRangeChange
    }
  };

  const handleGeneratePDF = async () => {
    if (!onGeneratePDF) return;

    setIsGeneratingPDF(true);
    try {
      await onGeneratePDF();
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="flex items-center justify-end">
      <div className="flex items-center gap-3">
        <DateRangePicker
          dateRange={dateRange}
          onDateRangeChange={handleDateSelect}
        />
        <Button
          onClick={handleGeneratePDF}
          disabled={isGeneratingPDF}
          variant="default"
        >
          {isGeneratingPDF ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generando...
            </>
          ) : (
            <>
              <FileDown className="mr-2 h-4 w-4" />
              Generar PDF
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
