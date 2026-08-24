import { ipcMain } from 'electron';
import { SalesService } from '@main/modules/sales/services/sales.service';
import { requirePermission, hasPermission } from '@main/shared/session';

const salesService = new SalesService();

export function registerSalesHandlers() {
  ipcMain.handle('process-sale', async (_event, { saleData, saleItems }) => {
    try {
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
      return result;
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });
}
