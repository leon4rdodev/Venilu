import { useMemo, useState } from "react";
import { DateRangePicker } from "@components/ui/date-range-picker";
import { Button } from "@components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@components/ui/dropdown-menu";
import { startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import type { DateRange } from "react-day-picker";
import { FileDown, FileText, FileSpreadsheet, ChevronDown, Landmark, Loader2 } from "lucide-react";
import { usePermissions } from "@renderer/features/auth/hooks/use-permission";
import { cn } from "@lib/utils";
import type { ExportKind } from "../hooks/use-reports";
import { Export607Dialog } from "./export-607-dialog";

interface ReportsHeaderProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  exporting: ExportKind | null;
  onGeneratePDF: () => void;
  onGenerateCSV: () => void;
}

interface Preset {
  key: string;
  label: string;
  range: () => { from: Date; to: Date };
}

const PRESETS: Preset[] = [
  { key: "today", label: "Hoy", range: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  {
    key: "yesterday",
    label: "Ayer",
    range: () => {
      const y = subDays(new Date(), 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    },
  },
  { key: "7d", label: "7 días", range: () => ({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) }) },
  { key: "30d", label: "30 días", range: () => ({ from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) }) },
  {
    key: "month",
    label: "Este mes",
    range: () => ({ from: startOfMonth(new Date()), to: endOfDay(new Date()) }),
  },
  {
    key: "prev-month",
    label: "Mes anterior",
    range: () => {
      const prev = subMonths(new Date(), 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    },
  },
];

/**
 * Toolbar del módulo de reportes: chips de presets de rango, selector de
 * rango custom y menú de exportación (PDF/CSV) gateado por permiso.
 * El preset activo se detecta por VALOR (comparando fechas), así que elegir
 * un rango custom en el picker desmarca los chips automáticamente.
 */
export function ReportsHeader({
  dateRange,
  onDateRangeChange,
  exporting,
  onGeneratePDF,
  onGenerateCSV,
}: ReportsHeaderProps) {
  const perms = usePermissions("reports:export_pdf");
  const canExport = perms["reports:export_pdf"];
  const [export607Open, setExport607Open] = useState(false);
  const isExporting = exporting !== null;

  const activePresetKey = useMemo(() => {
    if (!dateRange.from || !dateRange.to) return null;
    for (const preset of PRESETS) {
      const r = preset.range();
      if (r.from.getTime() === dateRange.from.getTime() && r.to.getTime() === dateRange.to.getTime()) {
        return preset.key;
      }
    }
    return null;
  }, [dateRange.from, dateRange.to]);

  const handlePreset = (preset: Preset) => {
    onDateRangeChange(preset.range());
  };

  const handleCustomRange = (range: DateRange | undefined) => {
    if (!range) return;
    onDateRangeChange({
      from: range.from ? startOfDay(range.from) : undefined,
      to: range.to ? endOfDay(range.to) : undefined,
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Presets: grupo de toggles (aria-pressed) con anillo de foco visible para teclado */}
      <div role="group" aria-label="Períodos predefinidos" className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map((preset) => {
          const isActive = activePresetKey === preset.key;
          return (
            <button
              key={preset.key}
              type="button"
              aria-pressed={isActive}
              onClick={() => handlePreset(preset)}
              className={cn(
                "px-3 h-9 rounded-full border text-xs font-medium transition-colors whitespace-nowrap",
                "outline-none focus-visible:ring-[1px] focus-visible:ring-ring focus-visible:border-ring",
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted"
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-w-2" />

      <DateRangePicker dateRange={dateRange} onDateRangeChange={handleCustomRange} />

      {canExport && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              disabled={isExporting}
              aria-busy={isExporting}
              aria-label={isExporting ? "Generando reporte" : "Exportar reporte"}
              className="h-9 shrink-0"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
              ) : (
                <FileDown className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              )}
              {isExporting ? "Generando…" : "Exportar"}
              {!isExporting && (
                <ChevronDown className="h-3.5 w-3.5 opacity-70" strokeWidth={1.75} aria-hidden="true" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" aria-label="Opciones de exportación" className="rounded-lg min-w-[200px]">
            <DropdownMenuItem onClick={onGeneratePDF} disabled={isExporting}>
              <FileText className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Exportar PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onGenerateCSV} disabled={isExporting}>
              <FileSpreadsheet className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Exportar CSV
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setExport607Open(true)} disabled={isExporting}>
              <Landmark className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Reporte 607 (DGII)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {canExport && (
        <Export607Dialog open={export607Open} onOpenChange={setExport607Open} />
      )}
    </div>
  );
}
