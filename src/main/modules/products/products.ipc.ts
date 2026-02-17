import { ipcMain } from "electron";
import { ProductsService } from "@main/modules/products/services/products.service";

const productsService = new ProductsService();

export function registerProductsHandlers() {
    ipcMain.handle('get-products', async (_event, options) => {
        try {
            const result = await productsService.findAll(options);
            return { success: true, ...result };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('get-products-for-pos', async (_event, options) => {
        try {
            const result = await productsService.getForPOS(options);
            return { success: true, ...result };
        } catch (error: any) {
             return { success: false, message: error.message };
        }
    });

    ipcMain.handle('create-product', async (_event, productData) => {
        try {
            const product = await productsService.create(productData);
            return { success: true, product };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('update-product', async (_event, { productId, productData }) => {
        try {
            console.log('IPC: update-product called with:', { productId, productDataKeys: Object.keys(productData || {}) });
            const product = await productsService.update(productId, productData);
            return { success: true, product };
        } catch (error: any) {
            console.error('IPC: update-product error:', error.message);
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('delete-product', async (_event, productId) => {
        try {
            await productsService.delete(productId);
            return { success: true };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('get-low-stock-products', async (_event, limit) => {
        try {
            const products = await productsService.getLowStock(limit);
            return { success: true, products };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('get-inventory-stats', async () => {
        try {
            const stats = await productsService.getInventoryStats();
            return { success: true, stats };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });
}
