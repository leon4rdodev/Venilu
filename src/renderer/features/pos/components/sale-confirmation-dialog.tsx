// src/components/pos/sale-confirmation-dialog.tsx


import { useState } from "react"
import { Dialog, DialogContent } from "@components/ui/dialog"
import { Button } from "@components/ui/button"
import { CheckCircle2, Printer, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@lib/utils"

type SaleConfirmationDialogProps = {
  open: boolean
  onOpenChange: (_open: boolean) => void
  saleId?: string
}

export function SaleConfirmationDialog({ open, onOpenChange, saleId }: SaleConfirmationDialogProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  const handleClose = () => {
    onOpenChange(false)
  }

  const handlePrintTicket = async () => {
    if (!saleId) {
      toast.error('Error', {
        description: 'No se pudo obtener el ID de la venta'
      });
      return;
    }

    try {
      if (!window.ipcRenderer) {
        toast.error('Error', {
          description: 'Sistema de impresión no disponible'
        });
        return;
      }

      setIsPrinting(true);

      const result = await window.ipcRenderer.invoke('print-receipt', { saleId }) as {
        success: boolean;
        message?: string;
      };

      if (result.success) {
        toast.success('Ticket impreso', {
          description: `Venta #${saleId}`
        });
      } else {
        toast.error('Error al imprimir', {
          description: result.message || 'No se pudo imprimir el ticket'
        });
      }
    } catch (error) {
      console.error('Error printing receipt:', error);
      toast.error('Error al imprimir', {
        description: 'Ocurrió un error inesperado'
      });
    } finally {
      setIsPrinting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
      <DialogContent
        className="sm:max-w-[420px] p-0 gap-0 overflow-hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Header con gradiente */}
        <div className="relative bg-linear-to-br from-green-500 to-emerald-600 p-8 pb-12">
          <div className="flex items-center justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-white/20 rounded-full blur-xl" />
              <div className="relative bg-white rounded-full p-3">
                <CheckCircle2 className="h-12 w-12 text-green-600" strokeWidth={2.5} />
              </div>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white text-center mb-2">
            ¡Venta Exitosa!
          </h2>
          <p className="text-green-50 text-center text-sm">
            La transacción se completó correctamente
          </p>
        </div>

        {/* Contenido */}
        <div className="p-6 space-y-6">
          {/* Detalles de la venta */}
          {saleId && (
            <div className="bg-muted/50 rounded-lg p-4 border border-border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Número de Venta</span>
                <span className="text-lg font-bold text-foreground">#{saleId}</span>
              </div>
            </div>
          )}

          {/* Botones de acción */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handlePrintTicket}
              disabled={isPrinting || !saleId}
              className={cn(
                "h-auto py-4 flex-col gap-2",
                "bg-primary hover:bg-primary/90"
              )}
            >
              <Printer className="h-5 w-5" />
              <span className="text-sm font-medium">
                {isPrinting ? 'Imprimiendo...' : 'Imprimir'}
              </span>
            </Button>

            <Button
              onClick={handleClose}
              disabled={isPrinting}
              variant="outline"
              className="h-auto py-4 flex-col gap-2 hover:bg-primary hover:text-primary-foreground hover:border-primary"
            >
              <X className="h-5 w-5" />
              <span className="text-sm font-medium">Cerrar</span>
            </Button>
          </div>

          {/* Mensaje informativo */}
          <p className="text-xs text-center text-muted-foreground">
            Puedes reimprimir este ticket desde el historial de ventas
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
