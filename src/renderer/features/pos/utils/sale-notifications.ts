import { toast } from "sonner";
import type { PaymentMethod } from "@shared/types/models";

/**
 * Notificación de éxito de la venta rápida.
 *
 * Solo se usa en el completado directo (botón "Completar Venta"):
 * cuando la venta se procesa desde el modal de pago ya se muestra
 * el modal de éxito con los detalles de la venta, así que un toast
 * ahí sería redundante.
 */
export function notifyQuickSaleSuccess(
  result: { saleId?: string; ncf?: string },
  paymentMethod: PaymentMethod,
  customerName?: string,
): void {
  const isCredit = paymentMethod === "credit";
  const ncfSuffix = result.ncf ? ` · NCF ${result.ncf}` : "";
  toast.success(isCredit ? "Venta a crédito registrada" : "Venta exitosa", {
    description: isCredit
      ? `Venta #${result.saleId} registrada a crédito para ${customerName}.${ncfSuffix}`
      : `Venta #${result.saleId} procesada correctamente.${ncfSuffix}`,
  });
}
