import { ipcMain } from "electron";
import { CustomersService } from "@main/modules/customers/services/customers.service";
import { requirePermission, hasPermission } from "@main/shared/session";

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

    /**
     * Mature paginated list with per-customer purchase aggregates.
     * Payload: { page, pageSize, search, filter, sortBy, sortOrder } (all optional).
     */
    ipcMain.handle('list-customers', async (_event, options) => {
        try {
            requirePermission('customers:view');
            const result = await customersService.list(options ?? {});
            return { success: true, data: result };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    /** Aggregated summary for the customer profile view. */
    ipcMain.handle('get-customer-summary', async (_event, customerId: string) => {
        try {
            requirePermission('customers:view');
            const summary = await customersService.getSummary(customerId);
            return { success: true, data: summary };
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
            const customer = await customersService.create(customerData, {
                allowLimitEdit: hasPermission('customers:edit_limit'),
            });
            return { success: true, data: customer };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('update-customer', async (_event, { customerId, customerData }) => {
        try {
            requirePermission('customers:create');
            await customersService.update(customerId, customerData, {
                allowLimitEdit: hasPermission('customers:edit_limit'),
            });
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
            const safePage = Math.max(1, Number(page) || 1);
            const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
            const result = await customersService.getCustomerSales(customerId, safePage, safeLimit);
            return { success: true, ...result };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('customers:getPayments', async (_event, { customerId, page = 1, limit = 20 }) => {
        try {
            requirePermission('customers:view');
            const safePage = Math.max(1, Number(page) || 1);
            const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
            const result = await customersService.getCustomerPayments(customerId, safePage, safeLimit);
            return { success: true, ...result };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });
}
