import { ipcMain } from "electron";
import { SalesService } from "@main/modules/sales/services/sales.service";
import { requireAuth } from "@main/shared/session";

const salesService = new SalesService();

export function registerSalesHandlers() {
    ipcMain.handle('process-sale', async (_event, { saleData, saleItems }) => {
        try {
            const result = await salesService.processSale(saleData, saleItems);
            return result;
        } catch (error: any) {
            console.error('Process Sale Error:', error);
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('get-sales', async () => {
        try {
            const sales = await salesService.getSales();
            return { success: true, data: sales };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('get-recent-sales', async (_event, limit) => {
        try {
            const sales = await salesService.getRecentSales(limit);
            return { success: true, data: sales };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('get-sale-items', async (_event, saleId) => {
        try {
            const items = await salesService.getSaleItems(saleId);
            return { success: true, data: items };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('pay-customer-debt', async (_event, { customerId, amount, shiftId, paymentMethod }) => {
        try {
            requireAuth();
            const result = await salesService.payDebt(customerId, amount, shiftId, paymentMethod || 'cash');
            return { success: true, data: result };
        } catch (error: any) {
            console.error('Pay Debt Error:', error);
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('get-customer-sales', async (_event, customerId) => {
        try {
            requireAuth();
            const sales = await salesService.getCustomerSales(customerId);
            return { success: true, data: sales };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });
}

