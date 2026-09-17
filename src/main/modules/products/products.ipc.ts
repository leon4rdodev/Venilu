import { ipcMain } from 'electron';
import { ProductsService } from '@main/modules/products/services/products.service';
import { requirePermission, hasPermission } from '@main/shared/session';
import { auditService } from '@main/modules/audit/services/audit.service';
import { AppDataSource } from '@main/config/data-source';
import { Product as ProductEntity } from '@main/modules/products/entities/product.entity';
import { csvRow, saveCsv } from '@main/shared/services/csv.util';
import { stockMovementsService } from '@main/modules/products/services/stock-movements.service';

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
      auditService.log('inventory:create', product.id, product.name, {
        sale_price: product.sale_price, cost_price: product.cost_price, stock: product.stock,
      });
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

      const before = await productsService.getById(productId);
      const product = await productsService.update(productId, productData, {
        canEditPrice: hasPermission('inventory:edit_price'),
        canAdjustStock: hasPermission('inventory:adjust_stock'),
      });

      // Audit: price changes and manual stock adjustments are the sensitive
      // ones (the manual promises both); anything else is a plain edit.
      if (before) {
        const priceChanged = Number(before.sale_price) !== Number(product.sale_price)
          || Number(before.cost_price) !== Number(product.cost_price);
        const stockChanged = Number(before.stock) !== Number(product.stock);
        if (priceChanged) {
          auditService.log('inventory:update_price', product.id,
            `${product.name}: venta ${Number(before.sale_price).toFixed(2)} → ${Number(product.sale_price).toFixed(2)}`
            + (Number(before.cost_price) !== Number(product.cost_price)
              ? ` · costo ${Number(before.cost_price).toFixed(2)} → ${Number(product.cost_price).toFixed(2)}` : ''),
            { before: { sale_price: before.sale_price, cost_price: before.cost_price }, after: { sale_price: product.sale_price, cost_price: product.cost_price } });
        }
        if (stockChanged) {
          auditService.log('inventory:adjust_stock', product.id,
            `${product.name}: ${before.stock} → ${product.stock}`,
            { before: before.stock, after: product.stock });
        }
        if (!priceChanged && !stockChanged) {
          auditService.log('inventory:update', product.id, product.name, {
            fields: Object.keys(productData ?? {}).filter(k => k !== 'image'),
          });
        }
      }
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
      // Cost figures are confidential — same rule as get-products.
      if (!hasPermission('inventory:view_costs')) {
        (stats as any).totalStockValue = null;
      }
      return { success: true, data: stats };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  /** Presentaciones (variantes) de un producto. */
  ipcMain.handle('get-product-variants', async (_event, { productId } = {}) => {
    try {
      requirePermission('inventory:view');
      if (typeof productId !== 'string' || !productId) throw new Error('Producto requerido');
      const data = await productsService.getVariants(productId);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  /**
   * Kardex for one product — paginated, newest first.
   * Payload: { productId, page?, pageSize? }
   */
  ipcMain.handle('get-stock-movements', async (_event, { productId, page, pageSize } = {}) => {
    try {
      requirePermission('inventory:view');
      if (typeof productId !== 'string' || !productId) {
        throw new Error('Producto requerido');
      }
      const data = await stockMovementsService.listByProduct(productId, page, pageSize);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  /** Full inventory dump as spreadsheet-friendly CSV (native save dialog). */
  ipcMain.handle('export-products-csv', async () => {
    try {
      requirePermission('inventory:view');
      const showCosts = hasPermission('inventory:view_costs');

      const products = await AppDataSource.getRepository(ProductEntity).find({
        relations: ['category'],
        order: { name: 'ASC' },
      });

      const num = (n: unknown) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);
      const lines: string[] = [];
      lines.push(csvRow(
        'Nombre', 'Categoría', 'Código de barras', 'SKU', 'Precio',
        ...(showCosts ? ['Costo'] : []),
        'Stock', 'Stock mínimo', 'Valor en stock',
      ));
      for (const p of products) {
        lines.push(csvRow(
          p.name,
          p.category?.name ?? '',
          p.barcode ?? '',
          p.sku ?? '',
          num(p.sale_price),
          ...(showCosts ? [num(p.cost_price)] : []),
          p.stock,
          p.min_stock,
          num(Number(p.sale_price) * Number(p.stock)),
        ));
      }

      const stamp = new Date().toISOString().slice(0, 10);
      return await saveCsv(`Inventario_${stamp}.csv`, lines);
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });
}
