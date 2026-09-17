import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Label } from "@components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/ui/select";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { subMonths } from "date-fns";
import { ipc } from "@lib/ipc";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface Export607DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Período por defecto: el mes anterior (el 607 se reporta a mes vencido). */
function defaultPeriod() {
  const prev = subMonths(new Date(), 1);
  return { month: prev.getMonth() + 1, year: prev.getFullYear() };
}

/**
 * Mini-diálogo para exportar el Reporte 607 de la DGII (ventas con NCF)
 * como CSV del período seleccionado, vía diálogo nativo de guardado.
 */
export function Export607Dialog({ open, onOpenChange }: Export607DialogProps) {
  const [month, setMonth] = useState<number>(() => defaultPeriod().month);
  const [year, setYear] = useState<number>(() => defaultPeriod().year);
  const [isExporting, setIsExporting] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];

  // Al reabrir, vuelve al período por defecto (mes anterior)
  useEffect(() => {
    if (open) {
      const p = defaultPeriod();
      setMonth(p.month);
      setYear(p.year);
    }
  }, [open]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = (await ipc.invoke("fiscal:export-607", { year, month })) as {
        success: boolean;
        filePath?: string;
        canceled?: boolean;
        message?: string;
      };

      if (result.success) {
        toast.success("Reporte 607 exportado", {
          description: result.filePath ? `Guardado en ${result.filePath}` : undefined,
        });
        onOpenChange(false);
      } else if (!result.canceled) {
        toast.error("Error al exportar el 607", { description: result.message });
      }
    } catch (_error) {
      toast.error("Error al exportar el 607");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !isExporting && onOpenChange(o)}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden">
        {/* Header: título + descripción enlazados al diálogo por Radix (aria-labelledby/describedby) */}
        <DialogHeader className="p-6 pb-4 gap-1 border-b border-border text-left">
          <DialogTitle className="text-lg font-semibold tracking-tight">Reporte 607 (DGII)</DialogTitle>
          <DialogDescription>
            Exporta las ventas con comprobante fiscal del período seleccionado en formato CSV.
          </DialogDescription>
        </DialogHeader>

        {/* Period selectors */}
        <div className="p-6 space-y-4" aria-busy={isExporting}>
          <div className="space-y-2">
            <Label htmlFor="export-607-month" className="text-xs text-muted-foreground">Mes</Label>
            <Select
              value={String(month)}
              onValueChange={(v) => setMonth(Number(v))}
              disabled={isExporting}
            >
              <SelectTrigger id="export-607-month" className="h-9 w-full bg-background">
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((name, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="export-607-year" className="text-xs text-muted-foreground">Año</Label>
            <Select
              value={String(year)}
              onValueChange={(v) => setYear(Number(v))}
              disabled={isExporting}
            >
              <SelectTrigger id="export-607-year" className="h-9 w-full bg-background">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    <span className="font-mono tabular-nums">{y}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Actions: cancelar a la izquierda, acción principal a la derecha */}
        <DialogFooter className="p-6 pt-4 border-t border-border flex-row gap-3 sm:justify-stretch">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
            className="flex-1 h-10"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleExport}
            disabled={isExporting}
            aria-busy={isExporting}
            className="flex-1 h-10 font-medium"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
                Exportando…
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Exportar 607
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
