

import { useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select"
import { Label } from "@components/ui/label"
import { Button } from "@components/ui/button"
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
  const [isLoadingPrinters, setIsLoadingPrinters] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Load settings
  useEffect(() => {
    if (settings) {
      setSelectedPrinter(settings.printer_name || '');
      setPaperSize(settings.paper_size || '80mm');
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
        paper_size: paperSize
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
            <div className="flex items-center gap-2">
              <Label htmlFor="printer-name" className="text-sm">Impresora</Label>
              <Button
                size="sm"
                variant="ghost"
                onClick={loadPrinters}
                disabled={isLoadingPrinters || isSaving}
                className="h-7 px-2 text-muted-foreground"
              >
                <RefreshCw className="h-3 w-3" strokeWidth={1.75} />
              </Button>
            </div>
            <Select
              value={selectedPrinter}
              onValueChange={setSelectedPrinter}
              disabled={isLoadingPrinters || isSaving}
            >
              <SelectTrigger id="printer-name" className="h-9">
                <SelectValue placeholder="Selecciona una impresora" />
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
            {printers.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Conecta una impresora USB y actualiza
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
              <SelectTrigger id="paper-size" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="58mm">58mm</SelectItem>
                <SelectItem value="80mm">80mm</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            onClick={handleTestPrint}
            disabled={!selectedPrinter || isTesting || isSaving}
            className="flex-1"
          >
            {isTesting ? (
              'Imprimiendo...'
            ) : (
              <>
                <Printer className="h-3 w-3 mr-2" strokeWidth={1.75} />
                Probar
              </>
            )}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || isTesting}
            className="flex-1"
          >
            {isSaving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
