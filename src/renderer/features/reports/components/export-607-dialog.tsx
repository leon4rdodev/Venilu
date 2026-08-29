import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@components/ui/select";
import { FileSpreadsheet } from "lucide-react";
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
        {/* Header */}
        <div className="p-6 pb-4 space-y-1 border-b border-border">
          <h2 className="text-lg font-semibold tracking-tight">Reporte 607 (DGII)</h2>
          <p className="text-sm text-muted-foreground">
            Exporta las ventas con comprobante fiscal del período seleccionado en formato CSV
          </p>
        </div>

        {/* Period selectors */}
        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Mes</label>
            <Select
              value={String(month)}
              onValueChange={(v) => setMonth(Number(v))}
              disabled={isExporting}
            >
              <SelectTrigger className="h-9 w-full bg-background">
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((name, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Año</label>
            <Select
              value={String(year)}
              onValueChange={(v) => setYear(Number(v))}
              disabled={isExporting}
            >
              <SelectTrigger className="h-9 w-full bg-background">
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

        {/* Actions */}
        <div className="p-6 pt-4 border-t border-border flex gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
            className="flex-1 h-10"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="flex-1 h-10 font-medium"
          >
            {isExporting ? (
              <>Exportando...</>
            ) : (
              <>
                <FileSpreadsheet className="h-4 w-4" strokeWidth={1.75} />
                Exportar 607
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
