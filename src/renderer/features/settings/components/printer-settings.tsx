

import { useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select"
import { Label } from "@components/ui/label"
import { Button } from "@components/ui/button"
import { Textarea } from "@components/ui/textarea"
import { Switch } from "@components/ui/switch"
import { RefreshCw, Printer } from "lucide-react"
import { toast } from "sonner"
import { useSettings } from "../hooks/use-settings"
import { Skeleton } from "@components/ui/skeleton"
import { WidgetHeader } from "@renderer/shared/components/widget-header"

interface PrinterInfo {
  name: string;
  displayName: string;
  description?: string;
  status?: number;
  isDefault?: boolean;
  options?: Record<string, any>;
}

export function PrinterSettings() {
  const { settings, isLoading, updateSettings } = useSettings();
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [paperSize, setPaperSize] = useState<string>('80mm');
  const [receiptFooter, setReceiptFooter] = useState<string>('');
  const [autoPrint, setAutoPrint] = useState<boolean>(false);
  const [isLoadingPrinters, setIsLoadingPrinters] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Load settings
  useEffect(() => {
    if (settings) {
      setSelectedPrinter(settings.printer_name || '');
      setPaperSize(settings.paper_size || '80mm');
      setReceiptFooter(settings.receipt_footer || '');
      setAutoPrint(Boolean(settings.auto_print_receipt));
    }
  }, [settings]);

  // Load printers on mount
  useEffect(() => {
    loadPrinters();
  }, []);

  const loadPrinters = async () => {
    setIsLoadingPrinters(true);
    // Add minimum delay to prevent UI flashing/glitching
    const minLoadTime = new Promise(resolve => setTimeout(resolve, 600));
    
    try {
      if (!window.ipcRenderer) {
        await minLoadTime;
        return;
      }

      const [result] = await Promise.all([
        window.ipcRenderer.invoke('get-printers') as Promise<{
          success: boolean;
          printers?: PrinterInfo[];
          message?: string;
        }>,
        minLoadTime
      ]);

      if (result.success && result.printers) {
        setPrinters(result.printers);

        // If no printer selected, select the default one
        if (!selectedPrinter && result.printers.length > 0) {
          const defaultPrinter = result.printers.find(p => p.isDefault);
          if (defaultPrinter) {
            setSelectedPrinter(defaultPrinter.name);
          }
        }
      } else {
        toast.error('Error al detectar impresoras', {
          description: result.message
        });
      }
    } catch (error) {
      console.error('Error loading printers:', error);
      toast.error('Error al cargar impresoras');
    } finally {
      setIsLoadingPrinters(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const result = await updateSettings({
        printer_name: selectedPrinter || null,
        paper_size: paperSize,
        receipt_footer: receiptFooter.trim() || null,
        auto_print_receipt: autoPrint
      });

      if (result.success) {
        toast.success('Configuración guardada', {
          description: 'La configuración de impresión se guardó correctamente'
        });
      } else {
        toast.error('Error al guardar', {
          description: result.message
        });
      }
    } catch (error) {
      console.error('Error saving printer settings:', error);
      toast.error('Error al guardar configuración');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestPrint = async () => {
    if (!selectedPrinter) {
      toast.error('Selecciona una impresora', {
        description: 'Debes seleccionar una impresora antes de probar'
      });
      return;
    }

    setIsTesting(true);

    try {
      if (!window.ipcRenderer) return;

      const result = await window.ipcRenderer.invoke('test-print', {
        printerName: selectedPrinter
      }) as {
        success: boolean;
        message?: string;
      };

      if (result.success) {
        toast.success('Impresión de prueba enviada', {
          description: 'Revisa la impresora para ver el resultado'
        });
      } else {
        toast.error('Error al imprimir', {
          description: result.message
        });
      }
    } catch (error) {
      console.error('Error testing print:', error);
      toast.error('Error al probar impresión');
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-20 w-full" />
          </div>
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-8 flex-1" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <WidgetHeader
        icon={Printer}
        title="Configuración de Impresora"
        subtitle="Configura la impresora de recibos"
      />

      <div className="mt-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="printer-name" className="text-sm">Impresora</Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={loadPrinters}
                disabled={isLoadingPrinters || isSaving}
                aria-label="Volver a detectar impresoras"
                title="Volver a detectar impresoras"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw
                  className={isLoadingPrinters ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                {isLoadingPrinters ? "Detectando…" : "Detectar"}
              </Button>
            </div>
            <Select
              value={selectedPrinter}
              onValueChange={setSelectedPrinter}
              disabled={isLoadingPrinters || isSaving}
            >
              <SelectTrigger
                id="printer-name"
                className="h-9 w-full"
                aria-describedby={printers.length === 0 ? "printer-name-hint" : undefined}
              >
                <SelectValue placeholder={isLoadingPrinters ? "Detectando impresoras…" : "Selecciona una impresora"} />
              </SelectTrigger>
              <SelectContent>
                {printers.length === 0 ? (
                  <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                    No se detectaron impresoras
                  </div>
                ) : (
                  printers.map((printer) => (
                    <SelectItem key={printer.name} value={printer.name}>
                      {printer.displayName}
                      {printer.isDefault && ' (Predeterminada)'}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {printers.length === 0 && !isLoadingPrinters && (
              <p id="printer-name-hint" className="text-xs text-muted-foreground">
                No se detectaron impresoras. Conecta una impresora USB y pulsa «Detectar».
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="paper-size" className="text-sm">Tamaño de Papel</Label>
            <Select
              value={paperSize}
              onValueChange={setPaperSize}
              disabled={isSaving}
            >
              <SelectTrigger id="paper-size" className="h-9 w-full" aria-describedby="paper-size-hint">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="58mm">58 mm</SelectItem>
                <SelectItem value="80mm">80 mm</SelectItem>
              </SelectContent>
            </Select>
            <p id="paper-size-hint" className="text-xs text-muted-foreground">
              Ancho del rollo térmico. El más común es 80 mm.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="receipt-footer" className="text-sm">Mensaje del ticket</Label>
          <Textarea
            id="receipt-footer"
            value={receiptFooter}
            onChange={(e) => setReceiptFooter(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="Gracias por su compra…"
            disabled={isSaving}
            aria-describedby="receipt-footer-hint"
            className="rounded-lg resize-none"
          />
          <div className="flex items-center justify-between gap-4">
            <p id="receipt-footer-hint" className="text-xs text-muted-foreground">
              Se imprime al pie de cada recibo. Una línea por renglón.
            </p>
            <span className="text-xs text-muted-foreground tabular-nums shrink-0" aria-live="polite">
              {receiptFooter.length}/300
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
          <div className="min-w-0">
            <Label htmlFor="auto-print" className="text-sm cursor-pointer">Impresión automática</Label>
            <p id="auto-print-hint" className="text-xs text-muted-foreground mt-1">
              Imprime el ticket automáticamente al completar cada venta.
            </p>
          </div>
          <Switch
            id="auto-print"
            checked={autoPrint}
            onCheckedChange={setAutoPrint}
            disabled={isSaving}
            aria-describedby="auto-print-hint"
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={handleTestPrint}
            disabled={!selectedPrinter || isTesting || isSaving}
            title={!selectedPrinter ? "Selecciona una impresora para probar" : undefined}
          >
            <Printer className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            {isTesting ? 'Imprimiendo…' : 'Imprimir prueba'}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isTesting}
            className="px-6"
          >
            {isSaving ? 'Guardando…' : 'Guardar Cambios'}
          </Button>
        </div>
      </div>
    </div>
  )
}
