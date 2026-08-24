import { ipcMain } from 'electron';
import { ProductsService } from '@main/modules/products/services/products.service';
import { requirePermission, hasPermission } from '@main/shared/session';
import { auditService } from '@main/modules/audit/services/audit.service';

const productsService = new ProductsService();

export function registerProductsHandlers() {
  /**
   * Returns inventory product list for managers.
   * cost_price is stripped server-side if the user lacks inventory:view_costs.
   */
  ipcMain.handle('get-products', async (_event, options) => {
    try {
      requirePermission('inventory:view');
      const result = await productsService.findAll(options);
      const canViewCosts = hasPermission('inventory:view_costs');

      const products = canViewCosts
        ? result.products
        : result.products.map(({ cost_price: _stripped, ...rest }: any) => rest);

      // Shape: { success, data: { products, pagination } } — matches use-products.ts
      return { success: true, data: { products, pagination: result.pagination } };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  /**
   * Lightweight product list for the POS screen.
   * Always strips cost_price — POS employees never need it.
   * Response shape: { success, data: { products, pagination } } — matches use-pos-products.ts
   */
  ipcMain.handle('get-products-for-pos', async (_event, options) => {
    try {
      requirePermission('pos:access');
      const result = await productsService.getForPOS(options);
      // Always strip cost_price from POS endpoint — employees never need it
      const products = result.products.map(({ cost_price: _stripped, ...rest }: any) => rest);
      return { success: true, data: { products, pagination: result.pagination } };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  /** Exact barcode/SKU lookup for the POS scanner. Strips cost_price. */
  ipcMain.handle('get-product-by-code', async (_event, code) => {
    try {
      requirePermission('pos:access');
      const product = await productsService.findByCode(code);
      if (!product) return { success: false, message: 'Producto no encontrado' };
      const { cost_price: _stripped, ...rest } = product as any;
      return { success: true, data: rest };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('create-product', async (_event, productData) => {
    try {
      requirePermission('inventory:create');
      const product = await productsService.create(productData);
      return { success: true, data: product };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('update-product', async (_event, { productId, productData }) => {
    try {
      // Always require inventory:edit; price/stock changes are additionally
      // gated inside the service (only when the value actually changes).
      requirePermission('inventory:edit');

      const product = await productsService.update(productId, productData, {
        canEditPrice: hasPermission('inventory:edit_price'),
        canAdjustStock: hasPermission('inventory:adjust_stock'),
      });
      return { success: true, data: product };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('delete-product', async (_event, productId) => {
    try {
      requirePermission('inventory:delete');
      await productsService.delete(productId);
      auditService.log('inventory:delete', productId);
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('get-low-stock-products', async (_event, limit) => {
    try {
      requirePermission('inventory:view');
      const products = await productsService.getLowStock(limit);
      return { success: true, data: products };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('get-inventory-stats', async () => {
    try {
      requirePermission('inventory:view');
      const stats = await productsService.getInventoryStats();
      return { success: true, data: stats };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });
}
