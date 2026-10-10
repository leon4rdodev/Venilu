import { toast } from "sonner";

/**
 * Imprime el ticket de una venta y notifica el resultado.
 * Devuelve true si se imprimió. Pensado para reutilizarlo
 * entre el diálogo de pago y la venta rápida (impresión
 * automática de Ajustes → Impresora).
 */
export async function printTicket(saleId: string): Promise<boolean> {
  if (!window.ipcRenderer) {
    toast.error("Error al imprimir", {
      description: "Sistema de impresión no disponible",
    });
    return false;
  }

  try {
    const result = (await window.ipcRenderer.invoke("print-receipt", {
      saleId,
    })) as { success: boolean; message?: string };

    if (result.success) {
      toast.success("Ticket impreso correctamente");
      return true;
    }
    toast.error("Error al imprimir", {
      description: result.message || "No se pudo imprimir el ticket",
    });
    return false;
  } catch {
    toast.error("Error al imprimir");
    return false;
  }
}
