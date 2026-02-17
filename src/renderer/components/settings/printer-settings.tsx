

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select"
import { Label } from "@components/ui/label"
import { Button } from "@components/ui/button"
import { RefreshCw, Printer } from "lucide-react"
import { toast } from "sonner"
import { useSettings } from "@hooks/use-settings"
import { Spinner } from "../ui/spinner"

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
      <Card>
        <CardContent className="flex justify-center py-12">
          <Spinner className="size-8" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Configuración de Impresora</CardTitle>
        <CardDescription className="text-xs">Configura la impresora de recibos</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label htmlFor="printer-name" className="text-sm">Impresora</Label>
              <Button
                size="sm"
                variant="ghost"
                onClick={loadPrinters}
                disabled={isLoadingPrinters || isSaving}
                className="h-7 px-2"
              >
                <RefreshCw className={`h-3 w-3 ${isLoadingPrinters ? 'animate-spin' : ''}`} />
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
              <>
                <Spinner className="size-3 mr-2" />
                Imprimiendo...
              </>
            ) : (
              <>
                <Printer className="h-3 w-3 mr-2" />
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
            {isSaving ? (
              <>
                <Spinner className="size-3 mr-2" />
                Guardando...
              </>
            ) : (
              'Guardar'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
