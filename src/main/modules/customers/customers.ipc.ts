import { ipcMain } from "electron";
import { CustomersService } from "@main/modules/customers/services/customers.service";
import { requireRole, requireAuth } from "@main/shared/session";

const customersService = new CustomersService();

export function registerCustomersHandlers() {
    // Any authenticated user can read and search customers
    ipcMain.handle('get-customers', async () => {
        try {
            requireAuth();
            const customers = await customersService.findAll();
            return { success: true, data: customers };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('search-customers', async (_event, query: string) => {
        try {
            requireAuth();
            const customers = await customersService.search(query);
            return { success: true, data: customers };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    // Both roles can create/update customers (employees need to register clients at POS)
    ipcMain.handle('create-customer', async (_event, customerData) => {
        try {
            requireAuth();
            const customer = await customersService.create(customerData);
            return { success: true, data: customer };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('update-customer', async (_event, { customerId, customerData }) => {
        try {
            requireAuth();
            await customersService.update(customerId, customerData);
            return { success: true };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    // Admin only for deletion
    ipcMain.handle('delete-customer', async (_event, customerId) => {
        try {
            requireRole('admin');
            await customersService.delete(customerId);
            return { success: true };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('get-customer-stats', async () => {
        try {
            requireAuth();
            const stats = await customersService.getStats();
            return { success: true, data: stats };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });
}
