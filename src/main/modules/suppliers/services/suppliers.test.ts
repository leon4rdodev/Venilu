import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { initTestDb, closeTestDb, resetTestDb, createTestUser, createTestProduct, createTestShift } from '../../../../test/db';
import { AppDataSource } from '@main/config/data-source';
import { Product } from '@main/modules/products/entities/product.entity';
import { StockMovement } from '@main/modules/products/entities/stock-movement.entity';
import { ShiftExpense } from '@main/modules/shifts/entities/shift-expense.entity';
import { Purchase } from '@main/modules/suppliers/entities/purchase.entity';
import { SuppliersService } from './suppliers.service';
import { PurchasesService } from './purchases.service';
import { ShiftsService } from '@main/modules/shifts/services/shifts.service';

describe('Suplidores y compras', () => {
  const suppliers = new SuppliersService();
  const purchases = new PurchasesService();
  const shifts = new ShiftsService();

  beforeAll(async () => { await initTestDb(); });
  afterAll(async () => { await closeTestDb(); });
  beforeEach(async () => { await resetTestDb(); });

  const productOf = (id: string) => AppDataSource.getRepository(Product).findOneByOrFail({ id });

  describe('suplidores', () => {
    it('crea, valida RNC/email/nombre duplicado y lista con agregados', async () => {
      const s = await suppliers.create({ name: 'distribuidora norte', rnc: '101-00000-1', phone: '(809) 555-0000', credit_days: 15 });
      expect(s.rnc).toBe('101000001');
      expect(s.phone).toBe('8095550000');
      expect(Number(s.balance)).toBe(0);

      await expect(suppliers.create({ name: 'Distribuidora Norte' })).rejects.toThrow(/Ya existe/);
      await expect(suppliers.create({ name: 'X', rnc: '12' })).rejects.toThrow(/RNC/);
      await expect(suppliers.create({ name: 'X', email: 'no-es-email' })).rejects.toThrow(/correo/);
      await expect(suppliers.create({ name: '  ' })).rejects.toThrow(/nombre/);
      await expect(suppliers.create({ name: 'X', credit_days: 400 })).rejects.toThrow(/días de crédito/);

      const page = await suppliers.list({});
      expect(page.total).toBe(1);
      expect(page.items[0].purchases_count).toBe(0);
    });

    it('sin compras se elimina; con compras se desactiva; con deuda no se toca', async () => {
      const user = await createTestUser();
      const clean = await suppliers.create({ name: 'Sin Compras' });
      expect(await suppliers.delete(clean.id)).toEqual({ deleted: true, deactivated: false });

      const s = await suppliers.create({ name: 'Con Compras' });
      const product = await createTestProduct({ stock: 5, cost_price: 10 });
      await purchases.create({ supplier_id: s.id, items: [{ product_id: product.id, quantity: 2, unit_cost: 10 }], payment_method: 'transfer' }, user.id);
      expect(await suppliers.delete(s.id)).toEqual({ deleted: false, deactivated: true });
      expect((await suppliers.findOne(s.id))!.active).toBe(false);

      const debtor = await suppliers.create({ name: 'Con Deuda' });
      await purchases.create({ supplier_id: debtor.id, items: [{ product_id: product.id, quantity: 1, unit_cost: 10 }], payment_method: 'credit' }, user.id);
      await expect(suppliers.delete(debtor.id)).rejects.toThrow(/cuentas por pagar/);
    });
  });

  describe('compras', () => {
    it('a crédito: entra stock, kardex, actualiza costo, deuda y vencimiento', async () => {
      const user = await createTestUser();
      const s = await suppliers.create({ name: 'Crédito 30', credit_days: 30 });
      const product = await createTestProduct({ stock: 10, cost_price: 50 });

      const p = await purchases.create({
        supplier_id: s.id,
        invoice_number: 'F-001',
        items: [{ product_id: product.id, quantity: 12, unit_cost: 55 }, { product_id: product.id, quantity: 3, unit_cost: 55 }],
        payment_method: 'credit',
      }, user.id);

      expect(p.total_amount).toBe(825); // 15 × 55 (líneas consolidadas)
      expect(p.payment_status).toBe('pending');
      expect(p.items).toHaveLength(1);
      expect(p.items[0].previous_cost).toBe(50);
      expect(p.due_date).toBeTruthy();
      const days = Math.round((new Date(p.due_date!).getTime() - Date.now()) / 86_400_000);
      expect(days).toBe(30);

      const prod = await productOf(product.id);
      expect(Number(prod.stock)).toBe(25);
      expect(Number(prod.cost_price)).toBe(55);

      const kardex = await AppDataSource.getRepository(StockMovement).find({ where: { type: 'purchase' } });
      expect(kardex).toHaveLength(1);
      expect(kardex[0].quantity_delta).toBe(15);
      expect(kardex[0].stock_after).toBe(25);
      expect(kardex[0].reference).toBe(p.id);

      expect(Number((await suppliers.findOne(s.id))!.balance)).toBe(825);
      const summary = await suppliers.getSummary(s.id);
      expect(summary.purchasesCount).toBe(1);
      expect(summary.totalPurchased).toBe(825);
      expect(summary.balance).toBe(825);
    });

    it('sin actualizar costos conserva el costo anterior', async () => {
      const user = await createTestUser();
      const s = await suppliers.create({ name: 'S' });
      const product = await createTestProduct({ stock: 0, cost_price: 20 });
      await purchases.create({ supplier_id: s.id, items: [{ product_id: product.id, quantity: 1, unit_cost: 99 }], payment_method: 'transfer', update_costs: false }, user.id);
      expect(Number((await productOf(product.id)).cost_price)).toBe(20);
    });

    it('en efectivo exige turno abierto y descuenta del arqueo como salida de caja', async () => {
      const user = await createTestUser();
      const s = await suppliers.create({ name: 'Contado' });
      const product = await createTestProduct({ stock: 0, cost_price: 10 });
      const input = { supplier_id: s.id, items: [{ product_id: product.id, quantity: 10, unit_cost: 12 }], payment_method: 'cash' as const };

      await expect(purchases.create(input, user.id)).rejects.toThrow(/turno/);

      const shift = await createTestShift(user.id, { initial_cash: 1000 });
      const p = await purchases.create(input, user.id);
      expect(p.payment_status).toBe('paid');
      expect(p.amount_paid).toBe(120);
      expect(p.due_date).toBeNull();

      const expenses = await AppDataSource.getRepository(ShiftExpense).find({ where: { shift_id: shift.id } });
      expect(expenses).toHaveLength(1);
      expect(Number(expenses[0].amount)).toBe(120);
      expect(expenses[0].reason).toContain(`Compra #${p.id}`);

      const closed = await shifts.closeShift(shift.id, 880, user.id);
      expect(closed.expected_cash).toBe(880); // 1000 − 120
      expect(closed.difference).toBe(0);
      expect(Number((await suppliers.findOne(s.id))!.balance)).toBe(0);
    });

    it('pago parcial al recibir deja la diferencia a crédito', async () => {
      const user = await createTestUser();
      const s = await suppliers.create({ name: 'Parcial', credit_days: 7 });
      const product = await createTestProduct({ stock: 0 });
      const p = await purchases.create({ supplier_id: s.id, items: [{ product_id: product.id, quantity: 4, unit_cost: 100 }], payment_method: 'transfer', amount_paid: 150 }, user.id);
      expect(p.payment_status).toBe('partial');
      expect(Number((await suppliers.findOne(s.id))!.balance)).toBe(250);
      await expect(purchases.create({ supplier_id: s.id, items: [{ product_id: product.id, quantity: 1, unit_cost: 10 }], payment_method: 'transfer', amount_paid: 50 }, user.id)).rejects.toThrow(/superar el total/);
    });

    it('valida líneas, suplidor inactivo y cantidades', async () => {
      const user = await createTestUser();
      const s = await suppliers.create({ name: 'Val' });
      const product = await createTestProduct({ stock: 0 });
      await expect(purchases.create({ supplier_id: s.id, items: [], payment_method: 'credit' }, user.id)).rejects.toThrow(/al menos un producto/);
      await expect(purchases.create({ supplier_id: s.id, items: [{ product_id: product.id, quantity: 1.5, unit_cost: 1 }], payment_method: 'credit' }, user.id)).rejects.toThrow(/cantidad/);
      await expect(purchases.create({ supplier_id: s.id, items: [{ product_id: product.id, quantity: 1, unit_cost: -1 }], payment_method: 'credit' }, user.id)).rejects.toThrow(/costo/);
      await suppliers.update(s.id, { active: false });
      await expect(purchases.create({ supplier_id: s.id, items: [{ product_id: product.id, quantity: 1, unit_cost: 1 }], payment_method: 'credit' }, user.id)).rejects.toThrow(/inactivo/);
    });

    it('anular revierte stock, costo y deuda; no si hay pagos o si ya se vendió', async () => {
      const user = await createTestUser();
      const s = await suppliers.create({ name: 'Anular' });
      const product = await createTestProduct({ stock: 2, cost_price: 30 });
      const p = await purchases.create({ supplier_id: s.id, items: [{ product_id: product.id, quantity: 8, unit_cost: 35 }], payment_method: 'credit' }, user.id);
      expect(Number((await productOf(product.id)).stock)).toBe(10);

      const cancelled = await purchases.cancel(p.id, 'mercancía dañada');
      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.cancelled_at).toBeTruthy();
      const prod = await productOf(product.id);
      expect(Number(prod.stock)).toBe(2);
      expect(Number(prod.cost_price)).toBe(30);
      expect(Number((await suppliers.findOne(s.id))!.balance)).toBe(0);
      const voids = await AppDataSource.getRepository(StockMovement).find({ where: { type: 'purchase_void' } });
      expect(voids).toHaveLength(1);
      expect(voids[0].quantity_delta).toBe(-8);
      await expect(purchases.cancel(p.id)).rejects.toThrow(/ya está anulada/);

      // Con pago no se anula
      const paid = await purchases.create({ supplier_id: s.id, items: [{ product_id: product.id, quantity: 1, unit_cost: 35 }], payment_method: 'transfer' }, user.id);
      await expect(purchases.cancel(paid.id)).rejects.toThrow(/pagos registrados/);

      // Si el stock ya no alcanza (se vendió), no se anula
      const sold = await purchases.create({ supplier_id: s.id, items: [{ product_id: product.id, quantity: 5, unit_cost: 35 }], payment_method: 'credit' }, user.id);
      const repo = AppDataSource.getRepository(Product);
      const current = await repo.findOneByOrFail({ id: product.id });
      current.stock = 3; await repo.save(current);
      await expect(purchases.cancel(sold.id)).rejects.toThrow(/ya se vendieron/);
    });
  });

  describe('pagos a suplidores', () => {
    it('aplica FIFO a las compras pendientes, baja el balance y sale de caja si es efectivo', async () => {
      const user = await createTestUser();
      const s = await suppliers.create({ name: 'Pagos', credit_days: 10 });
      const product = await createTestProduct({ stock: 0 });
      const p1 = await purchases.create({ supplier_id: s.id, items: [{ product_id: product.id, quantity: 1, unit_cost: 300 }], payment_method: 'credit' }, user.id);
      const p2 = await purchases.create({ supplier_id: s.id, items: [{ product_id: product.id, quantity: 1, unit_cost: 200 }], payment_method: 'credit' }, user.id);
      expect(Number((await suppliers.findOne(s.id))!.balance)).toBe(500);

      await expect(purchases.paySupplier(s.id, 600, 'transfer', user.id)).rejects.toThrow(/excede/);
      await expect(purchases.paySupplier(s.id, 100, 'cash', user.id)).rejects.toThrow(/turno/);

      const t = await purchases.paySupplier(s.id, 350, 'transfer', user.id, 'ref 123');
      expect(t.newBalance).toBe(150);
      const repo = AppDataSource.getRepository(Purchase);
      const a = await repo.findOneByOrFail({ id: p1.id });
      const b = await repo.findOneByOrFail({ id: p2.id });
      expect(a.payment_status).toBe('paid');
      expect(Number(a.amount_paid)).toBe(300);
      expect(b.payment_status).toBe('partial');
      expect(Number(b.amount_paid)).toBe(50);

      const shift = await createTestShift(user.id, { initial_cash: 500 });
      const c = await purchases.paySupplier(s.id, 150, 'cash', user.id);
      expect(c.newBalance).toBe(0);
      expect(c.expenseId).toBeTruthy();
      expect((await repo.findOneByOrFail({ id: p2.id })).payment_status).toBe('paid');
      const closed = await shifts.closeShift(shift.id, 350, user.id);
      expect(closed.expected_cash).toBe(350);

      await expect(purchases.paySupplier(s.id, 1, 'transfer', user.id)).rejects.toThrow(/no tiene cuentas/);
      const payments = await suppliers.getPayments(s.id);
      expect(payments.total).toBe(2);
      const stats = await suppliers.getStats();
      expect(stats.totalPayable).toBe(0);
      expect(stats.purchasesThisMonth).toBe(2);
      expect(stats.paidThisMonth).toBe(500);
    });
  });
});
