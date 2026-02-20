import { ipcMain } from "electron";
import { ProductsService } from "@main/modules/products/services/products.service";
import { requireRole, requireAuth } from "@main/shared/session";

const productsService = new ProductsService();

export function registerProductsHandlers() {
    // Any authenticated user can read products (needed for POS)
    ipcMain.handle('get-products', async (_event, options) => {
        try {
            requireAuth();
            const result = await productsService.findAll(options);
            return { success: true, ...result };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('get-products-for-pos', async (_event, options) => {
        try {
            requireAuth();
            const result = await productsService.getForPOS(options);
            return { success: true, ...result };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    // Admin only
    ipcMain.handle('create-product', async (_event, productData) => {
        try {
            requireRole('admin');
            const product = await productsService.create(productData);
            return { success: true, product };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    // Admin only
    ipcMain.handle('update-product', async (_event, { productId, productData }) => {
        try {
            requireRole('admin');
            const product = await productsService.update(productId, productData);
            return { success: true, product };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    // Admin only
    ipcMain.handle('delete-product', async (_event, productId) => {
        try {
            requireRole('admin');
            await productsService.delete(productId);
            return { success: true };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('get-low-stock-products', async (_event, limit) => {
        try {
            requireAuth();
            const products = await productsService.getLowStock(limit);
            return { success: true, products };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('get-inventory-stats', async () => {
        try {
            requireAuth();
            const stats = await productsService.getInventoryStats();
            return { success: true, stats };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });
}
