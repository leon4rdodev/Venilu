import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initTestDb, closeTestDb, resetTestDb,
  createTestUser, createTestProduct, createTestCustomer, createTestShift,
} from '../../../../test/db';
import { AppDataSource } from '@main/config/data-source';
import { DebtPayment } from '../entities/debt-payment.entity';
import { SalesService } from './sales.service';
import { ShiftsService } from '@main/modules/shifts/services/shifts.service';
import { ReportsService } from '@main/modules/reports/services/reports.service';

/**
 * Contabilidad de crédito (cash-collected):
 *   1. Una venta a crédito NO es ingreso hasta que el cliente paga.
 *   2. El abono cuenta como ingreso cuando ocurre.
 *   3. Anular una venta a crédito ya cobrada revierte TODO: stock, deuda y
 *      dinero (reembolso que resta del ingreso y del arqueo de caja).
 */
describe('Contabilidad de crédito', () => {
  const sales = new SalesService();
  const shifts = new ShiftsService();
  const reports = new ReportsService();

  const RANGE = {
    start: new Date(Date.now() - 24 * 3600 * 1000),
    end: new Date(Date.now() + 24 * 3600 * 1000),
  };

  beforeAll(async () => {
    await initTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await resetTestDb();
  });

  async function setup() {
    const user = await createTestUser();
    const shift = await createTestShift(user.id, { initial_cash: 1000 });
    const product = await createTestProduct({ stock: 20, sale_price: 100, cost_price: 60 });
    const customer = await createTestCustomer({ credit_limit: 5000 });
    return { user, shift, product, customer };
  }

  const creditSale = (u: string, s: string, p: string, c: string, qty = 3) =>
    sales.processSale(
      { user_id: u, shift_id: s, payment_method: 'credit', customer_id: c },
      [{ product_id: p, quantity: qty }],
    );

  it('una venta a crédito NO cuenta como ingreso hasta que se paga', async () => {
    const { user, shift, product, customer } = await setup();
    await creditSale(user.id, shift.id, product.id, customer.id); // 300 fiado

    const m = await reports.getTotalSalesMetrics(RANGE.start, RANGE.end);
    expect(m.current.totalAmount).toBe(0);           // nada cobrado aún
    expect(m.current.totalSalesCount).toBe(1);       // la transacción sí existe
    expect(m.current.totalCost).toBe(180);           // mercancía sí salió
    expect(m.current.netProfit).toBe(-180);          // aún no se recupera el costo

    const breakdown = await reports.getPaymentMethodBreakdown(RANGE.start, RANGE.end);
    const credit = breakdown.find(b => b.method === 'credit')!;
    expect(credit.total).toBe(300);                  // pendiente, no ingreso
  });

  it('el abono cuenta como ingreso al momento de pagarse', async () => {
    const { user, shift, product, customer } = await setup();
    await creditSale(user.id, shift.id, product.id, customer.id); // 300 fiado
    await sales.payDebt(customer.id, 120, shift.id, 'cash', user.id);

    const m = await reports.getTotalSalesMetrics(RANGE.start, RANGE.end);
    expect(m.current.totalAmount).toBe(120);         // solo lo cobrado

    const breakdown = await reports.getPaymentMethodBreakdown(RANGE.start, RANGE.end);
    expect(breakdown.find(b => b.method === 'cash')!.total).toBe(120);
    expect(breakdown.find(b => b.method === 'credit')!.total).toBe(180); // pendiente restante

    const overTime = await reports.getSalesOverTime(RANGE.start, RANGE.end, 'day');
    expect(overTime.reduce((s, r) => s + r.totalSales, 0)).toBe(120);
  });

  it('anular una venta a crédito COBRADA revierte stock, deuda y dinero', async () => {
    const { user, shift, product, customer } = await setup();
    const { saleId } = await creditSale(user.id, shift.id, product.id, customer.id); // 300
    await sales.payDebt(customer.id, 300, shift.id, 'cash', user.id); // pagó todo

    // establishSession no está activo en tests → el reembolso queda sin turno
    // atribuido, pero el registro existe y firma negativa en reportes.
    await sales.voidSale(saleId);

    // Stock restaurado
    const prod = await AppDataSource.getRepository('Product' as never).findOneBy({ id: product.id } as never) as { stock: number };
    expect(Number(prod.stock)).toBe(20);

    // Reembolso registrado con referencia a la venta
    const refunds = await AppDataSource.getRepository(DebtPayment).find({ where: { type: 'refund' } });
    expect(refunds).toHaveLength(1);
    expect(Number(refunds[0].amount)).toBe(300);
    expect(refunds[0].reference).toBe(saleId);

    // Deuda del cliente en cero (había pagado; anular no puede dejarla negativa)
    const cust = await AppDataSource.getRepository('Customer' as never).findOneBy({ id: customer.id } as never) as { balance: number };
    expect(Number(cust.balance)).toBe(0);

    // El dinero también se revierte: abono (+300) + reembolso (−300) = 0
    const m = await reports.getTotalSalesMetrics(RANGE.start, RANGE.end);
    expect(m.current.totalAmount).toBe(0);
    expect(m.current.totalCost).toBe(0); // la venta anulada tampoco cuenta costo
  });

  it('anular una venta a crédito PARCIALMENTE cobrada reembolsa lo pagado y borra lo pendiente', async () => {
    const { user, shift, product, customer } = await setup();
    const { saleId } = await creditSale(user.id, shift.id, product.id, customer.id); // 300
    await sales.payDebt(customer.id, 100, shift.id, 'cash', user.id);

    await sales.voidSale(saleId);

    const cust = await AppDataSource.getRepository('Customer' as never).findOneBy({ id: customer.id } as never) as { balance: number };
    expect(Number(cust.balance)).toBe(0); // los 200 pendientes se eliminan

    const refunds = await AppDataSource.getRepository(DebtPayment).find({ where: { type: 'refund' } });
    expect(Number(refunds[0].amount)).toBe(100); // solo lo realmente cobrado

    const m = await reports.getTotalSalesMetrics(RANGE.start, RANGE.end);
    expect(m.current.totalAmount).toBe(0); // +100 −100
  });

  it('el arqueo del turno resta los reembolsos en efectivo', async () => {
    const { user, shift, product, customer } = await setup();
    await creditSale(user.id, shift.id, product.id, customer.id); // 300
    await sales.payDebt(customer.id, 300, shift.id, 'cash', user.id);

    // Reembolso manual atribuido al turno (simula el void con turno abierto)
    const repo = AppDataSource.getRepository(DebtPayment);
    await repo.save(repo.create({
      customer_id: customer.id,
      shift_id: shift.id,
      amount: 300,
      payment_method: 'cash',
      type: 'refund',
    }));

    const closed = await shifts.closeShift(shift.id, 1000, user.id);
    // inicial 1000 + abono 300 − reembolso 300 = 1000
    expect(Number(closed.expected_cash)).toBe(1000);
    expect(Number(closed.difference)).toBe(0);
  });

  it('anular una venta a crédito SIN cobrar no genera reembolso', async () => {
    const { user, shift, product, customer } = await setup();
    const { saleId } = await creditSale(user.id, shift.id, product.id, customer.id);
    await sales.voidSale(saleId);

    const refunds = await AppDataSource.getRepository(DebtPayment).count({ where: { type: 'refund' } });
    expect(refunds).toBe(0);

    const cust = await AppDataSource.getRepository('Customer' as never).findOneBy({ id: customer.id } as never) as { balance: number };
    expect(Number(cust.balance)).toBe(0); // deuda revertida
  });
});
