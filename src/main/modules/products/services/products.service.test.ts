import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initTestDb,
  closeTestDb,
  resetTestDb,
  createTestUser,
  createTestProduct,
  createTestCategory,
  createTestSale,
} from '../../../../test/db';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  let service: ProductsService;

  beforeAll(async () => {
    await initTestDb();
    service = new ProductsService();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await resetTestDb();
  });

  // ─── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('crea con nombre recortado y coerción numérica desde strings', async () => {
      const product = await service.create({
        name: '  Refresco  ',
        sale_price: '25.5' as never,
        cost_price: '10' as never,
        stock: '7' as never,
        min_stock: '2' as never,
      });
      expect(product.name).toBe('Refresco');
      expect(product.sale_price).toBe(25.5);
      expect(product.cost_price).toBe(10);
      expect(product.stock).toBe(7);
      expect(product.min_stock).toBe(2);
    });

    it('rechaza sin nombre', async () => {
      await expect(service.create({ sale_price: 10 })).rejects.toThrow(/nombre.*requerido/);
      await expect(service.create({ name: '   ', sale_price: 10 })).rejects.toThrow(
        /nombre.*requerido/,
      );
    });

    it('validación numérica: precios negativos/no numéricos y stocks no enteros', async () => {
      await expect(service.create({ name: 'X', sale_price: 'abc' as never })).rejects.toThrow(
        /Precio de venta inválido/,
      );
      await expect(service.create({ name: 'X', sale_price: -1 })).rejects.toThrow(
        /Precio de venta inválido/,
      );
      await expect(
        service.create({ name: 'X', sale_price: 10, cost_price: -0.5 }),
      ).rejects.toThrow(/Precio de compra inválido/);
      await expect(
        service.create({ name: 'X', sale_price: 10, stock: 2.5 }),
      ).rejects.toThrow(/Stock inválido/);
      await expect(
        service.create({ name: 'X', sale_price: 10, min_stock: -1 }),
      ).rejects.toThrow(/Stock mínimo inválido/);
    });

    it('ignora campos fuera del whitelist (id, created_at, etc.)', async () => {
      const product = await service.create({
        name: 'Limpio',
        sale_price: 5,
        id: 'forced-id',
        created_at: new Date('2000-01-01'),
      } as never);
      expect(product.id).not.toBe('forced-id');
    });

    it('imagen inválida (no data-url ni nombre gestionado) rechazada', async () => {
      await expect(
        service.create({ name: 'X', sale_price: 5, image: '../../etc/passwd' }),
      ).rejects.toThrow(/Imagen de producto inválida/);
    });
  });

  // ─── update con flags de permiso ────────────────────────────────────────────

  describe('update', () => {
    it('cambiar precio sin canEditPrice es rechazado', async () => {
      const product = await createTestProduct({ sale_price: 100 });
      await expect(
        service.update(product.id, { sale_price: 120 }, { canEditPrice: false, canAdjustStock: true }),
      ).rejects.toThrow(/Sin permiso para modificar precios/);
      await expect(
        service.update(product.id, { cost_price: 99 }, { canEditPrice: false, canAdjustStock: true }),
      ).rejects.toThrow(/Sin permiso para modificar precios/);
    });

    it('reenviar el MISMO precio sin permiso pasa y aplica el resto de cambios', async () => {
      const product = await createTestProduct({ sale_price: 100, cost_price: 60 });
      const updated = await service.update(
        product.id,
        { name: 'Renombrado', sale_price: 100, cost_price: 60 },
        { canEditPrice: false, canAdjustStock: true },
      );
      expect(updated.name).toBe('Renombrado');
      expect(Number(updated.sale_price)).toBe(100);
    });

    it('ajustar stock sin canAdjustStock es rechazado; mismo stock pasa', async () => {
      const product = await createTestProduct({ stock: 10 });
      await expect(
        service.update(product.id, { stock: 99 }, { canEditPrice: true, canAdjustStock: false }),
      ).rejects.toThrow(/Sin permiso para ajustar el stock/);

      const updated = await service.update(
        product.id,
        { stock: 10, name: 'OK' },
        { canEditPrice: true, canAdjustStock: false },
      );
      expect(updated.stock).toBe(10);
      expect(updated.name).toBe('OK');
    });

    it('con permisos actualiza precio y stock', async () => {
      const product = await createTestProduct({ sale_price: 100, stock: 10 });
      const updated = await service.update(product.id, { sale_price: 150, stock: 20 });
      expect(Number(updated.sale_price)).toBe(150);
      expect(updated.stock).toBe(20);
    });

    it('category_id vacío se convierte en null', async () => {
      const category = await createTestCategory();
      const product = await createTestProduct({ category_id: category.id });
      const updated = await service.update(product.id, { category_id: '' as never });
      expect(updated.category_id ?? null).toBeNull();
    });

    it('validación numérica también aplica en update', async () => {
      const product = await createTestProduct();
      await expect(service.update(product.id, { sale_price: NaN })).rejects.toThrow(
        /Precio de venta inválido/,
      );
      await expect(service.update(product.id, { stock: -1 })).rejects.toThrow(/Stock inválido/);
    });

    it('rechaza id vacío, producto inexistente y nombre vacío', async () => {
      await expect(service.update('', { name: 'X' })).rejects.toThrow(/ID de producto/);
      await expect(service.update('ghost', { name: 'X' })).rejects.toThrow(/no encontrado/);
      const product = await createTestProduct();
      await expect(service.update(product.id, { name: '  ' })).rejects.toThrow(/requerido/);
    });

    it('payload vacío devuelve el producto sin cambios', async () => {
      const product = await createTestProduct();
      const updated = await service.update(product.id, {});
      expect(updated.id).toBe(product.id);
      expect(updated.name).toBe(product.name);
    });
  });

  // ─── findAll ────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('pagina con shape {products,pagination} y clampa pageSize a mínimo 10', async () => {
      for (let i = 0; i < 12; i++) await createTestProduct();
      const res = await service.findAll({ page: 1, pageSize: 2 });
      expect(res.products).toHaveLength(10); // take = max(10, pageSize)
      expect(res.pagination).toMatchObject({
        currentPage: 1,
        pageSize: 10,
        totalItems: 12,
        totalPages: 2,
        hasNextPage: true,
        hasPreviousPage: false,
      });
      const page2 = await service.findAll({ page: 2, pageSize: 10 });
      expect(page2.products).toHaveLength(2);
    });

    it('busca por nombre, sku y barcode', async () => {
      await createTestProduct({ name: 'Cerveza Fría', sku: 'SKU-77', barcode: '7501234' });
      await createTestProduct({ name: 'Agua' });
      expect((await service.findAll({ search: 'cerveza' })).products).toHaveLength(1);
      expect((await service.findAll({ search: 'SKU-77' })).products).toHaveLength(1);
      expect((await service.findAll({ search: '7501234' })).products).toHaveLength(1);
      expect((await service.findAll({ search: 'nada' })).products).toHaveLength(0);
    });

    it('filtra por categoría', async () => {
      const category = await createTestCategory();
      const inCat = await createTestProduct({ category_id: category.id });
      await createTestProduct();
      const res = await service.findAll({ category: category.id });
      expect(res.products.map(p => p.id)).toEqual([inCat.id]);
    });

    it("stockFilter 'low' = 0 < stock <= min_stock; 'out' = stock 0", async () => {
      const low = await createTestProduct({ stock: 3, min_stock: 5 });
      const out = await createTestProduct({ stock: 0, min_stock: 5 });
      await createTestProduct({ stock: 50, min_stock: 5 }); // sano

      const lowRes = await service.findAll({ stockFilter: 'low' });
      expect(lowRes.products.map(p => p.id)).toEqual([low.id]);

      const outRes = await service.findAll({ stockFilter: 'out' });
      expect(outRes.products.map(p => p.id)).toEqual([out.id]);
    });

    it('sort allowlist: campo inválido no rompe y cae a name', async () => {
      await createTestProduct({ name: 'Zeta', sale_price: 1 });
      await createTestProduct({ name: 'Alfa', sale_price: 9 });

      const byPrice = await service.findAll({ sortBy: 'sale_price', sortOrder: 'DESC' });
      expect(byPrice.products[0].name).toBe('Alfa');

      const evil = await service.findAll({ sortBy: 'price; DROP TABLE products;--' });
      expect(evil.products.map(p => p.name)).toEqual(['Alfa', 'Zeta']);
    });
  });

  // ─── findByCode ─────────────────────────────────────────────────────────────

  describe('findByCode', () => {
    it('busca por barcode o sku EXACTOS (con trim), sin coincidencias parciales', async () => {
      const product = await createTestProduct({ barcode: '750123456789', sku: 'ABC-1' });
      expect((await service.findByCode('750123456789'))?.id).toBe(product.id);
      expect((await service.findByCode('ABC-1'))?.id).toBe(product.id);
      expect((await service.findByCode('  ABC-1  '))?.id).toBe(product.id);
      expect(await service.findByCode('750123')).toBeNull(); // parcial no matchea
      expect(await service.findByCode('')).toBeNull();
      expect(await service.findByCode('   ')).toBeNull();
      expect(await service.findByCode('XXXX')).toBeNull();
    });
  });

  // ─── getLowStock / getInventoryStats ────────────────────────────────────────

  describe('getLowStock', () => {
    it('productos con stock <= min_stock (agotados incluidos), ordenados por stock ASC', async () => {
      const p1 = await createTestProduct({ stock: 1, min_stock: 5 });
      const p2 = await createTestProduct({ stock: 4, min_stock: 5 });
      const p0 = await createTestProduct({ stock: 0, min_stock: 5 }); // agotado: primero en la lista
      await createTestProduct({ stock: 10, min_stock: 5 });
      const rows = await service.getLowStock();
      expect(rows.map(p => p.id)).toEqual([p0.id, p1.id, p2.id]);
    });
  });

  describe('getInventoryStats', () => {
    it('totales de unidades, valor de costo y valor de venta', async () => {
      await createTestProduct({ sale_price: 100, cost_price: 60, stock: 10, min_stock: 5 });
      await createTestProduct({ sale_price: 50, cost_price: 20, stock: 0, min_stock: 5 });
      await createTestProduct({ sale_price: 10, cost_price: 5, stock: 2, min_stock: 5 });

      const stats = await service.getInventoryStats();
      expect(stats).toEqual({
        totalProducts: 3,
        totalStockUnits: 12,
        totalStockValue: 610, // 60×10 + 5×2
        totalRetailValue: 1020, // 100×10 + 10×2
        outOfStockProducts: 1,
        lowStockProducts: 1,
      });
    });

    it('sin productos devuelve ceros', async () => {
      const stats = await service.getInventoryStats();
      expect(stats.totalProducts).toBe(0);
      expect(stats.totalStockUnits).toBe(0);
      expect(stats.totalRetailValue).toBe(0);
    });
  });

  // ─── getForPOS ──────────────────────────────────────────────────────────────

  describe('getForPOS', () => {
    it('anota stock_status según el stock', async () => {
      await createTestProduct({ name: 'Con stock', stock: 5 });
      await createTestProduct({ name: 'Agotado', stock: 0 });
      const res = await service.getForPOS({});
      const byName = Object.fromEntries(res.products.map(p => [p.name, p.stock_status]));
      expect(byName['Con stock']).toBe('in_stock');
      expect(byName['Agotado']).toBe('out_of_stock');
    });
  });

  // ─── delete ─────────────────────────────────────────────────────────────────

  // ─── códigos de barras adicionales ──────────────────────────────────────────

  describe('códigos de barras adicionales', () => {
    it('crea con N códigos, depura repetidos/vacíos y el escáner encuentra cualquiera', async () => {
      const product = await service.create({
        name: 'Gatorade 600ml',
        sale_price: 100,
        barcode: '7460548000161',
        extra_barcodes: ['7460548000154', ' 7460548000130 ', '', '7460548000154', '7460548000161', '7460548000185'],
      } as never);

      const stored = await service.getById(product.id);
      expect(stored?.barcodes?.map((b) => b.code).sort()).toEqual(['7460548000130', '7460548000154', '7460548000185']);

      for (const code of ['7460548000161', '7460548000154', '7460548000130', '7460548000185']) {
        expect((await service.findByCode(code))?.id).toBe(product.id);
      }
      expect(await service.findByCode('0000')).toBeNull();
    });

    it('la búsqueda del inventario también encuentra por código adicional y devuelve los códigos', async () => {
      const product = await service.create({ name: 'Cereser', sale_price: 50, extra_barcodes: ['7896072902723'] } as never);
      await createTestProduct({ name: 'Otro' });

      const result = await service.findAll({ search: '78960729027' });
      expect(result.pagination.totalItems).toBe(1);
      expect(result.products[0].id).toBe(product.id);
      expect(result.products[0].barcodes?.map((b) => b.code)).toEqual(['7896072902723']);
    });

    it('un código no puede repetirse entre productos (barcode, sku o adicional)', async () => {
      await service.create({ name: 'A', sale_price: 1, barcode: 'B-1', sku: 'S-1', extra_barcodes: ['X-1'] } as never);

      await expect(service.create({ name: 'B', sale_price: 1, barcode: 'X-1' })).rejects.toThrow(/"X-1" ya está en uso por "A"/);
      await expect(service.create({ name: 'B', sale_price: 1, sku: 'X-1' })).rejects.toThrow(/ya está en uso/);
      await expect(service.create({ name: 'B', sale_price: 1, extra_barcodes: ['X-1'] } as never)).rejects.toThrow(/ya está en uso/);
      await expect(service.create({ name: 'B', sale_price: 1, extra_barcodes: ['B-1'] } as never)).rejects.toThrow(/ya está en uso/);
      await expect(service.create({ name: 'B', sale_price: 1, extra_barcodes: ['S-1'] } as never)).rejects.toThrow(/ya está en uso/);
      await expect(service.create({ name: 'B', sale_price: 1, extra_barcodes: 'X-2' } as never)).rejects.toThrow(/inválidos/);
    });

    it('update reemplaza el set completo; sin extra_barcodes no los toca; promover a principal no duplica', async () => {
      const product = await service.create({ name: 'A', sale_price: 1, barcode: 'P', extra_barcodes: ['E1', 'E2'] } as never);
      const codes = async () => (await service.getById(product.id))?.barcodes?.map((b) => b.code).sort();

      await service.update(product.id, { name: 'A2' });
      expect(await codes()).toEqual(['E1', 'E2']);

      await service.update(product.id, { extra_barcodes: ['E2', 'E3'] } as never);
      expect(await codes()).toEqual(['E2', 'E3']);
      expect(await service.findByCode('E1')).toBeNull();

      // E3 pasa a ser el principal: deja de ser adicional
      const updated = await service.update(product.id, { barcode: 'E3' });
      expect(updated.barcode).toBe('E3');
      expect(await codes()).toEqual(['E2']);

      await service.update(product.id, { extra_barcodes: [] } as never);
      expect(await codes()).toEqual([]);
    });
  });

  // ─── archivar / restaurar / borrar definitivamente ──────────────────────────

  describe('archivado (borrado lógico)', () => {
    it('archivar oculta de listado, escáner, stock bajo y estadísticas — incluso con ventas', async () => {
      const user = await createTestUser();
      const product = await createTestProduct({ barcode: 'ARC-1', stock: 1, min_stock: 5 });
      await createTestSale({
        user_id: user.id,
        total_amount: 100,
        items: [{ product_id: product.id, quantity: 1, unit_price: 100 }],
      });

      await service.archive(product.id);

      expect((await service.findAll({})).pagination.totalItems).toBe(0);
      expect(await service.findByCode('ARC-1')).toBeNull();
      expect(await service.getLowStock()).toHaveLength(0);
      expect((await service.getInventoryStats()).totalProducts).toBe(0);
      expect(await service.countArchived()).toBe(1);

      const archived = await service.findAll({ archived: true });
      expect(archived.pagination.totalItems).toBe(1);
      expect((archived.products[0] as { has_sales?: boolean }).has_sales).toBe(true);

      await expect(service.update(product.id, { name: 'X' })).rejects.toThrow(/archivado/);
      await expect(service.archive('ghost')).rejects.toThrow(/no encontrado/);
    });

    it('restaurar lo devuelve al inventario con sus códigos', async () => {
      const product = await service.create({ name: 'A', sale_price: 1, barcode: 'R-1', extra_barcodes: ['R-2'] } as never);
      await service.archive(product.id);
      await service.restore(product.id);

      expect((await service.findAll({})).pagination.totalItems).toBe(1);
      expect((await service.findByCode('R-2'))?.id).toBe(product.id);
      expect(await service.countArchived()).toBe(0);
    });

    it('un archivado libera sus códigos; restaurar falla si otro producto ya los tomó', async () => {
      const old = await service.create({ name: 'Viejo', sale_price: 1, barcode: 'DUP', extra_barcodes: ['DUP-2'] } as never);
      await service.archive(old.id);

      const fresh = await service.create({ name: 'Nuevo', sale_price: 1, extra_barcodes: ['DUP-2'] } as never);
      expect((await service.findByCode('DUP-2'))?.id).toBe(fresh.id);

      await expect(service.restore(old.id)).rejects.toThrow(/"DUP-2" ahora lo usa "Nuevo"/);
      await service.update(fresh.id, { extra_barcodes: [] } as never);
      await service.restore(old.id);
      expect((await service.findByCode('DUP-2'))?.id).toBe(old.id);
    });

    it('borrado definitivo: solo archivados y solo si nunca se vendieron', async () => {
      const user = await createTestUser();
      const sold = await createTestProduct();
      const unsold = await service.create({ name: 'Sin ventas', sale_price: 1, extra_barcodes: ['GONE'] } as never);
      await createTestSale({
        user_id: user.id,
        total_amount: 100,
        items: [{ product_id: sold.id, quantity: 1, unit_price: 100 }],
      });

      await expect(service.deletePermanently(unsold.id)).rejects.toThrow(/Solo se pueden eliminar definitivamente productos archivados/);

      await service.archive(sold.id);
      await service.archive(unsold.id);
      await expect(service.deletePermanently(sold.id)).rejects.toThrow(/ventas asociadas/);

      await service.deletePermanently(unsold.id);
      expect(await service.getById(unsold.id)).toBeNull();
      expect(await service.countArchived()).toBe(1);
      await expect(service.deletePermanently('ghost')).rejects.toThrow(/no encontrado/);

      // El código del producto borrado queda libre
      await service.create({ name: 'Reusa', sale_price: 1, barcode: 'GONE' });
    });
  });
});
