import { ipcMain } from 'electron';
import { SalesService } from '@main/modules/sales/services/sales.service';
import { requirePermission, hasPermission } from '@main/shared/session';
import { auditService } from '@main/modules/audit/services/audit.service';
import { licenseService } from '@main/shared/services/license.service';

const salesService = new SalesService();

export function registerSalesHandlers() {
  ipcMain.handle('process-sale', async (_event, { saleData, saleItems }) => {
    try {
      // Charging is the licensed capability: blocked when the trial is over
      // or an annual license expired. Data stays viewable/exportable always.
      await licenseService.assertCanSell();
      const session = requirePermission('pos:access');

      // Granular POS permissions
      if (Number(saleData?.discount_amount) > 0) requirePermission('pos:apply_discount');
      if (saleData?.payment_method === 'credit') requirePermission('pos:credit_sale');

      // The sale is ALWAYS attributed to the session user — never to a
      // renderer-supplied user_id.
      const data = { ...saleData, user_id: session.id };

      const result = await salesService.processSale(data, saleItems, {
        allowPriceOverride: hasPermission('pos:price_override'),
      });
      return result;
    } catch (err: any) {
      console.error('[sales.ipc] process-sale:', err);
      return { success: false, message: err.message };
    }
  });

  /**
   * Filtered + paginated transaction history.
   * Payload: { page, pageSize, search, method, status, startDate, endDate } (all optional).
   */
  ipcMain.handle('get-sales', async (_event, options) => {
    try {
      requirePermission('sales:view');
      const result = await salesService.listSales(options ?? {});
      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('get-recent-sales', async (_event, limit) => {
    try {
      requirePermission('sales:view');
      const sales = await salesService.getRecentSales(limit);
      return { success: true, data: sales };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('get-sale-items', async (_event, saleId) => {
    try {
      requirePermission(['sales:view', 'pos:access']);
      const items = await salesService.getSaleItems(saleId);
      return { success: true, data: items };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('pay-customer-debt', async (_event, { customerId, amount, shiftId, paymentMethod }) => {
    try {
      const session = requirePermission('customers:pay_debt');

      const method = paymentMethod ?? 'cash';
      if (method !== 'cash' && method !== 'transfer') {
        throw new Error('Método de pago inválido.');
      }

      const result = await salesService.payDebt(customerId, amount, shiftId, method, session.id);
      auditService.log('customers:pay_debt', String(customerId),
        `${result.payment.amount.toFixed(2)} (${method === 'cash' ? 'efectivo' : 'transferencia'}) · deuda restante ${result.newBalance.toFixed(2)}`,
        { amount: result.payment.amount, method, newBalance: result.newBalance });
      return { success: true, data: result };
    } catch (err: any) {
      console.error('[sales.ipc] pay-customer-debt:', err);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('get-customer-sales', async (_event, customerId) => {
    try {
      requirePermission('customers:view');
      const sales = await salesService.getCustomerSales(customerId);
      return { success: true, data: sales };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('sales:void', async (_event, { saleId }) => {
    try {
      requirePermission('sales:void');
      const result = await salesService.voidSale(saleId);
      auditService.log('sales:void', String(saleId), `Venta #${saleId}`);
      return result;
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  /**
   * Devolución parcial de artículos.
   * Payload: { saleId, items: [{ sale_item_id, quantity }], note? }
   */
  ipcMain.handle('sales:return', async (_event, { saleId, items, note } = {}) => {
    try {
      const session = requirePermission('sales:return');
      const result = await salesService.processReturn(String(saleId ?? ''), items, session.id, note);
      auditService.log('sales:return', String(saleId), `Venta #${saleId} · reembolso ${result.totalRefunded.toFixed(2)}`, {
        returnId: result.returnId,
        totalRefunded: result.totalRefunded,
        creditNoteNcf: result.creditNoteNcf,
      });
      return result;
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  /** Devoluciones registradas de una venta (detalle de transacción). */
  ipcMain.handle('get-sale-returns', async (_event, { saleId } = {}) => {
    try {
      requirePermission('pos:access');
      const data = await salesService.getSaleReturns(String(saleId ?? ''));
      return { success: true, data };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });
}
