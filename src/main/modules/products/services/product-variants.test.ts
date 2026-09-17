import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initTestDb, closeTestDb, resetTestDb, createTestProduct } from '../../../../test/db';
import { ProductsService } from './products.service';

describe('Presentaciones de producto (variantes)', () => {
  const service = new ProductsService();

  beforeAll(async () => { await initTestDb(); });
  afterAll(async () => { await closeTestDb(); });
  beforeEach(async () => { await resetTestDb(); });

  it('crea una presentación vinculada al padre con sus propios datos', async () => {
    const parent = await createTestProduct({ name: 'Refresco Rojo', sale_price: 100 });
    const variant = await service.create({
      name: 'Refresco Rojo Pequeño',
      variant_name: 'Pequeño 250ml',
      parent_product_id: parent.id,
      sale_price: 45,
      stock: 24,
      barcode: '7460009990001',
    });

    expect(variant.parent_product_id).toBe(parent.id);
    expect(variant.variant_name).toBe('Pequeño 250ml');
    expect(Number(variant.sale_price)).toBe(45);

    const variants = await service.getVariants(parent.id);
    expect(variants).toHaveLength(1);
    expect(variants[0].id).toBe(variant.id);
  });

  it('rechaza padre inexistente y anidación (presentación de presentación)', async () => {
    await expect(service.create({
      name: 'Huérfana', sale_price: 10, parent_product_id: 'no-existe',
    })).rejects.toThrow(/padre no existe/);

    const parent = await createTestProduct({});
    const child = await service.create({
      name: 'Hija', sale_price: 10, parent_product_id: parent.id, variant_name: 'Chica',
    });
    await expect(service.create({
      name: 'Nieta', sale_price: 5, parent_product_id: child.id,
    })).rejects.toThrow(/no puede tener presentaciones/);
  });

  it('un producto no puede ser su propio padre ni convertirse en presentación teniendo hijas', async () => {
    const parent = await createTestProduct({});
    await service.create({ name: 'Hija', sale_price: 10, parent_product_id: parent.id });
    const other = await createTestProduct({});

    await expect(
      service.update(parent.id, { parent_product_id: parent.id }, { canEditPrice: true, canAdjustStock: true }),
    ).rejects.toThrow(/sí mismo/);

    await expect(
      service.update(parent.id, { parent_product_id: other.id }, { canEditPrice: true, canAdjustStock: true }),
    ).rejects.toThrow(/tiene presentaciones/);
  });

  it('no se elimina un padre con presentaciones; la presentación sí', async () => {
    const parent = await createTestProduct({});
    const child = await service.create({ name: 'Hija', sale_price: 10, parent_product_id: parent.id });

    await expect(service.delete(parent.id)).rejects.toThrow(/tiene presentaciones/);
    await service.delete(child.id);
    await service.delete(parent.id); // ya sin hijas
    expect(await service.getVariants(parent.id)).toHaveLength(0);
  });

  it('desvincular: parent_product_id vacío la vuelve producto principal', async () => {
    const parent = await createTestProduct({});
    const child = await service.create({ name: 'Hija', sale_price: 10, parent_product_id: parent.id, variant_name: 'X' });
    const updated = await service.update(child.id, { parent_product_id: '' }, { canEditPrice: true, canAdjustStock: true });
    expect(updated.parent_product_id ?? null).toBeNull();
  });
});
