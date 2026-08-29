import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initTestDb, closeTestDb, resetTestDb,
  createTestUser, createTestProduct, createTestShift,
} from '../../../../test/db';
import { AppDataSource } from '@main/config/data-source';
import { StockMovement } from '../entities/stock-movement.entity';
import { StockMovementsService } from './stock-movements.service';
import { ProductsService } from './products.service';
import { SalesService } from '@main/modules/sales/services/sales.service';

const movementsFor = (productId: string) =>
  AppDataSource.getRepository(StockMovement).find({
    where: { product_id: productId },
    order: { created_at: 'ASC' },
  });

describe('Kardex (StockMovements)', () => {
  const service = new StockMovementsService();

  beforeAll(async () => {
    await initTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await resetTestDb();
  });

  it('una venta registra un movimiento negativo por línea con referencia y stock resultante', async () => {
    const user = await createTestUser();
    const shift = await createTestShift(user.id);
    const p1 = await createTestProduct({ stock: 10 });
    const p2 = await createTestProduct({ stock: 5 });

    const sales = new SalesService();
    const result = await sales.processSale(
      { user_id: user.id, shift_id: shift.id, payment_method: 'cash', amount_paid: 1000 },
      [
        { product_id: p1.id, quantity: 3 },
        { product_id: p2.id, quantity: 2 },
      ],
    );

    const m1 = await movementsFor(p1.id);
    expect(m1).toHaveLength(1);
    expect(m1[0].type).toBe('sale');
    expect(m1[0].quantity_delta).toBe(-3);
    expect(m1[0].stock_after).toBe(7);
    expect(m1[0].reference).toBe(result.saleId);

    const m2 = await movementsFor(p2.id);
    expect(m2[0].quantity_delta).toBe(-2);
    expect(m2[0].stock_after).toBe(3);
  });

  it('una venta fallida (stock insuficiente) no deja movimientos (rollback)', async () => {
    const user = await createTestUser();
    const shift = await createTestShift(user.id);
    const ok = await createTestProduct({ stock: 10 });
    const scarce = await createTestProduct({ stock: 1 });

    const sales = new SalesService();
    await expect(
      sales.processSale(
        { user_id: user.id, shift_id: shift.id, payment_method: 'cash', amount_paid: 1000 },
        [
          { product_id: ok.id, quantity: 2 },
          { product_id: scarce.id, quantity: 5 },
        ],
      ),
    ).rejects.toThrow(/Insufficient stock/);

    expect(await movementsFor(ok.id)).toHaveLength(0);
    expect(await movementsFor(scarce.id)).toHaveLength(0);
  });

  it('anular una venta registra el movimiento de reposición', async () => {
    const user = await createTestUser();
    const shift = await createTestShift(user.id);
    const product = await createTestProduct({ stock: 10 });

    const sales = new SalesService();
    const { saleId } = await sales.processSale(
      { user_id: user.id, shift_id: shift.id, payment_method: 'cash', amount_paid: 1000 },
      [{ product_id: product.id, quantity: 4 }],
    );
    await sales.voidSale(saleId);

    const movements = await movementsFor(product.id);
    expect(movements).toHaveLength(2);
    const voidMove = movements.find(m => m.type === 'void')!;
    expect(voidMove.quantity_delta).toBe(4);
    expect(voidMove.stock_after).toBe(10);
    expect(voidMove.reference).toBe(saleId);
    expect(voidMove.note).toBe('Anulación de venta');
  });

  it('crear un producto con stock registra el movimiento inicial (y con 0 no)', async () => {
    const products = new ProductsService();
    const withStock = await products.create({ name: 'Con stock', sale_price: 50, stock: 12 });
    const without = await products.create({ name: 'Sin stock', sale_price: 50, stock: 0 });

    const m = await movementsFor(withStock.id);
    expect(m).toHaveLength(1);
    expect(m[0].type).toBe('initial');
    expect(m[0].quantity_delta).toBe(12);
    expect(m[0].stock_after).toBe(12);

    expect(await movementsFor(without.id)).toHaveLength(0);
  });

  it('un ajuste manual registra el delta; un update sin cambiar stock no registra nada', async () => {
    const products = new ProductsService();
    const product = await createTestProduct({ stock: 20 });

    await products.update(product.id, { stock: 15 }, { canEditPrice: true, canAdjustStock: true });
    let movements = await movementsFor(product.id);
    expect(movements).toHaveLength(1);
    expect(movements[0].type).toBe('adjustment');
    expect(movements[0].quantity_delta).toBe(-5);
    expect(movements[0].stock_after).toBe(15);

    // Same value resent (edit dialog) → no new movement
    await products.update(product.id, { stock: 15, name: 'Renombrado' }, { canEditPrice: true, canAdjustStock: true });
    movements = await movementsFor(product.id);
    expect(movements).toHaveLength(1);
  });

  it('listByProduct pagina de más reciente a más antiguo', async () => {
    const products = new ProductsService();
    const product = await createTestProduct({ stock: 0 });

    for (let i = 1; i <= 4; i++) {
      await products.update(product.id, { stock: i * 10 }, { canEditPrice: true, canAdjustStock: true });
    }

    const page1 = await service.listByProduct(product.id, 1, 3);
    expect(page1.total).toBe(4);
    expect(page1.totalPages).toBe(2);
    expect(page1.items).toHaveLength(3);
    // Newest first: the last adjustment left stock at 40
    expect(page1.items[0].stock_after).toBe(40);

    const page2 = await service.listByProduct(product.id, 2, 3);
    expect(page2.items).toHaveLength(1);
  });
});
