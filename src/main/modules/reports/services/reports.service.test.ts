import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initTestDb,
  closeTestDb,
  resetTestDb,
  createTestUser,
  createTestShift,
  createTestProduct,
  createTestCategory,
  createTestCustomer,
  createTestSale,
} from '../../../../test/db';
import { ReportsService } from './reports.service';
import type { User } from '@main/modules/users/entities/user.entity';
import type { Product } from '@main/modules/products/entities/product.entity';
import type { Customer } from '@main/modules/customers/entities/customer.entity';

/** Fecha local YYYY-MM-DD como la produce STRFTIME(..., 'localtime'). */
const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('ReportsService', () => {
  let service: ReportsService;
  let user: User;
  let productA: Product; // 100 venta / 60 costo, con categoría "Bebidas"
  let productB: Product; // 50 venta / 20 costo, SIN categoría
  let customer: Customer;

  beforeAll(async () => {
    await initTestDb();
    service = new ReportsService();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  /**
   * Escenario estándar:
   *  - Venta 1 (cash, paid, cliente): 2×A = 200
   *  - Venta 2 (card, paid, sin cliente): 1×B = 50
   *  - Venta 3 (cash, VOIDED, cliente): 1×A = 100 → nunca debe contar
   * Totales esperados: ingresos 250, costo 140, ganancia 110, margen 44 %.
   */
  beforeEach(async () => {
    await resetTestDb();
    user = await createTestUser();
    const category = await createTestCategory({ name: 'Bebidas' });
    productA = await createTestProduct({ sale_price: 100, cost_price: 60, category_id: category.id });
    productB = await createTestProduct({ sale_price: 50, cost_price: 20 });
    customer = await createTestCustomer({ name: 'Ana Buenapaga' });

    await createTestSale({
      user_id: user.id,
      customer_id: customer.id,
      payment_method: 'cash',
      total_amount: 200,
      items: [{ product_id: productA.id, quantity: 2, unit_price: 100 }],
    });
    await createTestSale({
      user_id: user.id,
      payment_method: 'card',
      total_amount: 50,
      items: [{ product_id: productB.id, quantity: 1, unit_price: 50 }],
    });
    await createTestSale({
      user_id: user.id,
      customer_id: customer.id,
      payment_method: 'cash',
      status: 'voided',
      total_amount: 100,
      items: [{ product_id: productA.id, quantity: 1, unit_price: 100 }],
    });
  });

  // ─── getTotalSalesMetrics ───────────────────────────────────────────────────

  describe('getTotalSalesMetrics', () => {
    it('excluye ventas anuladas y calcula netProfit/averageMargin/averageTicket', async () => {
      const { current, previous } = await service.getTotalSalesMetrics(null, null);
      expect(current.totalAmount).toBe(250);
      expect(current.totalSalesCount).toBe(2);
      expect(current.totalItemsSold).toBe(3);
      expect(current.totalCost).toBe(140); // 2×60 + 1×20
      expect(current.netProfit).toBe(110);
      expect(current.averageMargin).toBeCloseTo(44, 10); // 110/250 × 100
      expect(current.averageTicket).toBe(125);
      expect(previous).toBeUndefined(); // sin rango no hay periodo anterior
    });

    it('con rango devuelve también el periodo anterior', async () => {
      const start = new Date(Date.now() - 60 * 60 * 1000);
      const end = new Date(Date.now() + 60 * 60 * 1000);
      const { current, previous } = await service.getTotalSalesMetrics(start, end);
      expect(current.totalAmount).toBe(250);
      expect(previous).toBeDefined();
      expect(previous!.totalAmount).toBe(0);
      expect(previous!.averageMargin).toBe(0);
      expect(previous!.averageTicket).toBe(0);
    });

    it('un rango sin ventas devuelve ceros', async () => {
      const { current } = await service.getTotalSalesMetrics(
        new Date('2019-01-01'),
        new Date('2019-12-31'),
      );
      expect(current.totalAmount).toBe(0);
      expect(current.netProfit).toBe(0);
      expect(current.totalSalesCount).toBe(0);
    });
  });

  // ─── getSalesOverTime ───────────────────────────────────────────────────────

  describe('getSalesOverTime', () => {
    it("'day' agrupa por fecha local con totalProfit correcto", async () => {
      const rows = await service.getSalesOverTime(null, null, 'day');
      expect(rows).toHaveLength(1);
      expect(rows[0].period).toBe(localDay(new Date()));
      expect(rows[0].totalSales).toBe(250);
      expect(rows[0].totalTransactions).toBe(2);
      expect(rows[0].totalProfit).toBe(110);
    });

    it("'day' separa periodos y ordena ascendente", async () => {
      await createTestSale({
        user_id: user.id,
        total_amount: 30,
        created_at: new Date('2020-06-15T12:00:00Z'),
        items: [{ product_id: productB.id, quantity: 1, unit_price: 30 }],
      });
      const rows = await service.getSalesOverTime(null, null, 'day');
      expect(rows).toHaveLength(2);
      expect(rows[0].period < rows[1].period).toBe(true);
      expect(rows[0].totalSales).toBe(30);
      expect(rows[0].totalProfit).toBe(10); // 30 − costo 20
    });

    it("'week' agrupa con formato YYYY-W##", async () => {
      const rows = await service.getSalesOverTime(null, null, 'week');
      expect(rows).toHaveLength(1);
      expect(rows[0].period).toMatch(/^\d{4}-W\d{2}$/);
      expect(rows[0].totalSales).toBe(250);
      expect(rows[0].totalProfit).toBe(110);
    });

    it("'month' agrupa con formato YYYY-MM", async () => {
      const rows = await service.getSalesOverTime(null, null, 'month');
      expect(rows).toHaveLength(1);
      expect(rows[0].period).toMatch(/^\d{4}-\d{2}$/);
      expect(rows[0].totalSales).toBe(250);
    });
  });

  // ─── Rankings de productos ──────────────────────────────────────────────────

  describe('getTopSellingProducts / getLeastSellingProducts', () => {
    it('top: ordena por unidades DESC con totalProfit y margin', async () => {
      const rows = await service.getTopSellingProducts(null, null, 5);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({
        productName: productA.name,
        totalSold: 2,
        totalRevenue: 200,
        totalProfit: 80, // 200 − 2×60
        margin: 40,
      });
      expect(rows[1]).toEqual({
        productName: productB.name,
        totalSold: 1,
        totalRevenue: 50,
        totalProfit: 30,
        margin: 60,
      });
    });

    it('least: ordena por unidades ASC y respeta el límite', async () => {
      const rows = await service.getLeastSellingProducts(null, null, 1);
      expect(rows).toHaveLength(1);
      expect(rows[0].productName).toBe(productB.name);
    });

    it('excluye las ventas anuladas del ranking', async () => {
      const rows = await service.getTopSellingProducts(null, null, 5);
      const a = rows.find(r => r.productName === productA.name)!;
      expect(a.totalSold).toBe(2); // la unidad de la venta anulada no cuenta
    });
  });

  // ─── getPaymentMethodBreakdown ──────────────────────────────────────────────

  describe('getPaymentMethodBreakdown', () => {
    it('agrupa por método excluyendo anuladas, ordenado por total DESC', async () => {
      const rows = await service.getPaymentMethodBreakdown(null, null);
      expect(rows).toEqual([
        { method: 'cash', total: 200, transactions: 1 },
        { method: 'card', total: 50, transactions: 1 },
      ]);
    });
  });

  // ─── getCategoryBreakdown ───────────────────────────────────────────────────

  describe('getCategoryBreakdown', () => {
    it("producto sin categoría cae en 'Sin categoría'; ordena por ingresos DESC", async () => {
      const rows = await service.getCategoryBreakdown(null, null);
      expect(rows).toEqual([
        { categoryName: 'Bebidas', totalSold: 2, totalRevenue: 200, totalProfit: 80, margin: 40 },
        { categoryName: 'Sin categoría', totalSold: 1, totalRevenue: 50, totalProfit: 30, margin: 60 },
      ]);
    });
  });

  // ─── getTopCustomers ────────────────────────────────────────────────────────

  describe('getTopCustomers', () => {
    it('excluye ventas sin cliente y anuladas; calcula averageTicket', async () => {
      const rows = await service.getTopCustomers(null, null, 5);
      expect(rows).toHaveLength(1); // la venta card sin customer_id no aparece
      expect(rows[0]).toEqual({
        customerId: customer.id,
        customerName: 'Ana Buenapaga',
        totalSpent: 200, // la anulada de 100 no cuenta
        totalTransactions: 1,
        averageTicket: 200,
      });
    });

    it('ordena por gasto DESC y respeta el límite', async () => {
      const rich = await createTestCustomer({ name: 'Cliente VIP' });
      await createTestSale({ user_id: user.id, customer_id: rich.id, total_amount: 900 });
      const top1 = await service.getTopCustomers(null, null, 1);
      expect(top1).toHaveLength(1);
      expect(top1[0].customerId).toBe(rich.id);
    });
  });

  // ─── getFullReport ──────────────────────────────────────────────────────────

  describe('getFullReport', () => {
    it('devuelve todas las secciones coherentes entre sí', async () => {
      const report = await service.getFullReport(null, null, 'day');
      expect(Object.keys(report).sort()).toEqual([
        'categoryBreakdown',
        'leastSellingProducts',
        'metrics',
        'paymentBreakdown',
        'salesOverTime',
        'topCustomers',
        'topSellingProducts',
      ]);
      expect(report.metrics.current.totalAmount).toBe(250);
      expect(report.salesOverTime[0].totalSales).toBe(250);
      expect(report.topSellingProducts).toHaveLength(2);
      expect(report.paymentBreakdown.reduce((s, r) => s + r.total, 0)).toBe(250);
    });
  });

  // ─── Widgets de dashboard ───────────────────────────────────────────────────

  describe('getDashboardStats / getSalesByHour / getPaymentMethodTotals', () => {
    it('getDashboardStats: hoy con datos, ayer en cero', async () => {
      const stats = await service.getDashboardStats();
      expect(stats.today.totalSales).toBe(250);
      expect(stats.today.totalTransactions).toBe(2);
      expect(stats.today.netProfit).toBe(110);
      expect(stats.yesterday.totalSales).toBe(0);
    });

    it('getSalesByHour agrupa las ventas de hoy en su hora local', async () => {
      const rows = await service.getSalesByHour(0);
      expect(rows).toHaveLength(1);
      expect(rows[0].total).toBe(250);
      expect(rows[0].transactions).toBe(2);
      expect(rows[0].hour).toBeGreaterThanOrEqual(0);
      expect(rows[0].hour).toBeLessThanOrEqual(23);
    });

    it('getPaymentMethodTotals refleja solo hoy y sin anuladas', async () => {
      const rows = await service.getPaymentMethodTotals();
      const byMethod = Object.fromEntries(rows.map(r => [r.method, r.total]));
      expect(byMethod).toEqual({ cash: 200, card: 50 });
    });
  });

  // ─── getShiftSummary ────────────────────────────────────────────────────────

  describe('getShiftSummary', () => {
    it('sin turno abierto devuelve hasOpenShift false y ceros', async () => {
      const summary = await service.getShiftSummary(user.id);
      expect(summary).toEqual({ hasOpenShift: false, totalTransactions: 0, totalAmount: 0 });
    });

    it('con turno abierto suma solo las ventas no anuladas del turno', async () => {
      const shift = await createTestShift(user.id);
      await createTestSale({ user_id: user.id, shift_id: shift.id, total_amount: 120 });
      await createTestSale({ user_id: user.id, shift_id: shift.id, total_amount: 80 });
      await createTestSale({ user_id: user.id, shift_id: shift.id, total_amount: 999, status: 'voided' });

      const summary = await service.getShiftSummary(user.id);
      expect(summary.hasOpenShift).toBe(true);
      expect(summary.shiftId).toBe(shift.id);
      expect(summary.totalTransactions).toBe(2);
      expect(summary.totalAmount).toBe(200);
    });
  });
});
