import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initTestDb, closeTestDb, resetTestDb,
  createTestUser, createTestProduct, createTestCustomer, createTestShift,
} from '../../../../test/db';
import { AppDataSource } from '@main/config/data-source';
import { StockMovement } from '@main/modules/products/entities/stock-movement.entity';
import { Setting } from '@main/modules/settings/entities/setting.entity';
import { SalesService } from './sales.service';
import { ShiftsService } from '@main/modules/shifts/services/shifts.service';
import { ReportsService } from '@main/modules/reports/services/reports.service';
import { FiscalService } from '@main/modules/fiscal/services/fiscal.service';

describe('Devoluciones parciales', () => {
  const sales = new SalesService();
  const shifts = new ShiftsService();
  const reports = new ReportsService();

  const RANGE = {
    start: new Date(Date.now() - 24 * 3600 * 1000),
    end: new Date(Date.now() + 24 * 3600 * 1000),
  };

  beforeAll(async () => { await initTestDb(); });
  afterAll(async () => { await closeTestDb(); });
  beforeEach(async () => { await resetTestDb(); });

  async function setup() {
    const user = await createTestUser();
    const shift = await createTestShift(user.id, { initial_cash: 1000 });
    const product = await createTestProduct({ sale_price: 100, cost_price: 60, stock: 50 });
    return { user, shift, product };
  }

  async function cashSale(u: string, s: string, p: string, qty = 4, discount = 0) {
    return sales.processSale(
      { user_id: u, shift_id: s, payment_method: 'cash', amount_paid: 10_000, discount_amount: discount },
      [{ product_id: p, quantity: qty }],
    );
  }

  it('devuelve parte: stock, kardex, montos y reportes se ajustan', async () => {
    const { user, shift, product } = await setup();
    const { saleId } = await cashSale(user.id, shift.id, product.id, 4); // 400

    const saleItems = await sales.getSaleItems(saleId);
    const r = await sales.processReturn(
      saleId, [{ sale_item_id: saleItems[0].id!, quantity: 1 }], user.id, 'cliente cambió de opinión',
    );
    expect(r.totalRefunded).toBe(100);

    // Stock repuesto + kardex tipo 'return'
    const prod = await AppDataSource.getRepository('Product' as never).findOneBy({ id: product.id } as never) as { stock: number };
    expect(Number(prod.stock)).toBe(47); // 50 − 4 + 1
    const kardex = await AppDataSource.getRepository(StockMovement).find({ where: { type: 'return' } });
    expect(kardex).toHaveLength(1);
    expect(kardex[0].quantity_delta).toBe(1);
    expect(kardex[0].reference).toBe(saleId);

    // Reportes: ingreso 400 − 100 = 300; costo 240 − 60 = 180
    const m = await reports.getTotalSalesMetrics(RANGE.start, RANGE.end);
    expect(m.current.totalAmount).toBe(300);
    expect(m.current.totalCost).toBe(180);

    // Arqueo del turno: inicial 1000 + venta cash 400 − devolución 100 = 1300
    const closed = await shifts.closeShift(shift.id, 1300, user.id);
    expect(Number(closed.expected_cash)).toBe(1300);
    expect(Number(closed.difference)).toBe(0);
  });

  it('no permite devolver más de lo que queda (acumulando devoluciones)', async () => {
    const { user, shift, product } = await setup();
    const { saleId } = await cashSale(user.id, shift.id, product.id, 3);
    const items = await sales.getSaleItems(saleId);

    await sales.processReturn(saleId, [{ sale_item_id: items[0].id!, quantity: 2 }], user.id);
    await expect(
      sales.processReturn(saleId, [{ sale_item_id: items[0].id!, quantity: 2 }], user.id),
    ).rejects.toThrow(/solo quedan 1/);
    // La restante sí procede
    const r2 = await sales.processReturn(saleId, [{ sale_item_id: items[0].id!, quantity: 1 }], user.id);
    expect(r2.totalRefunded).toBe(100);
  });

  it('prorratea el descuento de la venta', async () => {
    const { user, shift, product } = await setup();
    // 4 × 100 = 400, descuento 100 → total 300 (factor 0.75)
    const { saleId } = await cashSale(user.id, shift.id, product.id, 4, 100);
    const items = await sales.getSaleItems(saleId);
    const r = await sales.processReturn(saleId, [{ sale_item_id: items[0].id!, quantity: 2 }], user.id);
    expect(r.totalRefunded).toBe(150); // 200 × 0.75
  });

  it('venta a crédito con deuda pendiente: se rechaza (anular en su lugar)', async () => {
    const { user, shift, product } = await setup();
    const customer = await createTestCustomer({ credit_limit: 5000 });
    const { saleId } = await sales.processSale(
      { user_id: user.id, shift_id: shift.id, payment_method: 'credit', customer_id: customer.id },
      [{ product_id: product.id, quantity: 2 }],
    );
    const items = await sales.getSaleItems(saleId);
    await expect(
      sales.processReturn(saleId, [{ sale_item_id: items[0].id!, quantity: 1 }], user.id),
    ).rejects.toThrow(/deuda pendiente/);

    // Saldada la deuda, la devolución sí procede
    await sales.payDebt(customer.id, 200, shift.id, 'cash', user.id);
    const r = await sales.processReturn(saleId, [{ sale_item_id: items[0].id!, quantity: 1 }], user.id);
    expect(r.totalRefunded).toBe(100);
  });

  it('exige turno abierto del usuario', async () => {
    const { user, shift, product } = await setup();
    const { saleId } = await cashSale(user.id, shift.id, product.id, 2);
    const items = await sales.getSaleItems(saleId);
    await shifts.closeShift(shift.id, 99999, user.id);

    await expect(
      sales.processReturn(saleId, [{ sale_item_id: items[0].id!, quantity: 1 }], user.id),
    ).rejects.toThrow(/Abre un turno/);
  });

  it('venta con NCF: la devolución emite su propia B04 (y sin secuencia se bloquea)', async () => {
    const { user, shift, product } = await setup();
    const settingsRepo = AppDataSource.getRepository(Setting);
    await settingsRepo.save(settingsRepo.create({ id: 1, business_name: 'T', paper_size: '80mm', fiscal_enabled: true, itbis_rate: 18 }));
    const fiscal = new FiscalService();
    await fiscal.saveSequence({ type: 'B02', from_number: 1, to_number: 10 });

    const { saleId } = await sales.processSale(
      { user_id: user.id, shift_id: shift.id, payment_method: 'cash', amount_paid: 1000, fiscal: { ncfType: 'B02' } },
      [{ product_id: product.id, quantity: 2 }],
    );
    const items = await sales.getSaleItems(saleId);

    await expect(
      sales.processReturn(saleId, [{ sale_item_id: items[0].id!, quantity: 1 }], user.id),
    ).rejects.toThrow(/B04/);

    await fiscal.saveSequence({ type: 'B04', from_number: 1, to_number: 10 });
    const r = await sales.processReturn(saleId, [{ sale_item_id: items[0].id!, quantity: 1 }], user.id);
    expect(r.creditNoteNcf).toBe('B0400000001');

    const stored = await sales.getSaleReturns(saleId);
    expect(stored).toHaveLength(1);
    expect(stored[0].credit_note_ncf).toBe('B0400000001');
    expect(stored[0].items).toHaveLength(1);
  });
});
