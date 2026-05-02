import { ipcMain } from "electron";
import { CustomersService } from "@main/modules/customers/services/customers.service";
import { requirePermission, requireAuth } from "@main/shared/session";

const customersService = new CustomersService();

export function registerCustomersHandlers() {
    // Permission required to even see the list
    ipcMain.handle('get-customers', async () => {
        try {
            requirePermission('customers:view');
            const customers = await customersService.findAll();
            return { success: true, data: customers };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('get-customer', async (_event, id: string) => {
        try {
            requirePermission('customers:view');
            const customer = await customersService.findOne(id);
            return { success: true, data: customer };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('search-customers', async (_event, query: string) => {
        try {
            requirePermission('customers:view');
            const customers = await customersService.search(query);
            return { success: true, data: customers };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    // Guarded by customers:create permission
    ipcMain.handle('create-customer', async (_event, customerData) => {
        try {
            requirePermission('customers:create');
            const customer = await customersService.create(customerData);
            return { success: true, data: customer };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('update-customer', async (_event, { customerId, customerData }) => {
        try {
            requirePermission('customers:create');
            await customersService.update(customerId, customerData);
            return { success: true };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    // Guarded by customers:delete permission
    ipcMain.handle('delete-customer', async (_event, customerId) => {
        try {
            requirePermission('customers:delete');
            await customersService.delete(customerId);
            return { success: true };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('get-customer-stats', async () => {
        try {
            requirePermission('customers:view');
            const stats = await customersService.getStats();
            return { success: true, data: stats };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('customers:getSales', async (_event, { customerId, page = 1, limit = 20 }) => {
        try {
            requirePermission('customers:view');
            const result = await customersService.getCustomerSales(customerId, page, limit);
            return { success: true, ...result };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('customers:getPayments', async (_event, { customerId, page = 1, limit = 20 }) => {
        try {
            requirePermission('customers:view');
            const result = await customersService.getCustomerPayments(customerId, page, limit);
            return { success: true, ...result };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });
}
