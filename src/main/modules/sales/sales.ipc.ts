import { ipcMain } from 'electron';
import { SalesService } from '@main/modules/sales/services/sales.service';
import { requirePermission } from '@main/shared/session';

const salesService = new SalesService();

export function registerSalesHandlers() {
  ipcMain.handle('process-sale', async (_event, { saleData, saleItems }) => {
    try {
      requirePermission('pos:access');
      const result = await salesService.processSale(saleData, saleItems);
      return result;
    } catch (err: any) {
      console.error('[sales.ipc] process-sale:', err);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('get-sales', async () => {
    try {
      requirePermission('sales:view');
      const sales = await salesService.getSales();
      return { success: true, data: sales };
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
      console.log(`[SalesIPC] Fetching items for sale: ${saleId}`);
      requirePermission(['sales:view', 'pos:access']);
      const items = await salesService.getSaleItems(saleId);
      console.log(`[SalesIPC] Found ${items.length} items`);
      return { success: true, data: items };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('pay-customer-debt', async (_event, { customerId, amount, shiftId, paymentMethod }) => {
    try {
      requirePermission('customers:pay_debt');
      const result = await salesService.payDebt(customerId, amount, shiftId, paymentMethod || 'cash');
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
