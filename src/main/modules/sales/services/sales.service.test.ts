import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initTestDb,
  closeTestDb,
  resetTestDb,
  createTestUser,
  createTestShift,
  createTestProduct,
  createTestCustomer,
  createTestSale,
} from '../../../../test/db';
import { SalesService } from './sales.service';
import { AppDataSource } from '@main/config/data-source';
import { Sale } from '../entities/sale.entity';
import { SaleItem } from '../entities/sale-item.entity';
import { Product } from '@main/modules/products/entities/product.entity';
import { Customer } from '@main/modules/customers/entities/customer.entity';
import { DebtPayment } from '../entities/debt-payment.entity';
import type { User } from '@main/modules/users/entities/user.entity';
import type { Shift } from '@main/modules/shifts/entities/shift.entity';

describe('SalesService', () => {
  let service: SalesService;
  let user: User;
  let shift: Shift;

  const getProduct = (id: string) => AppDataSource.getRepository(Product).findOneByOrFail({ id });
  const getCustomer = (id: string) => AppDataSource.getRepository(Customer).findOneByOrFail({ id });
  const getSale = (id: string) =>
    AppDataSource.getRepository(Sale).findOneOrFail({ where: { id }, relations: ['items'] });

  beforeAll(async () => {
    await initTestDb();
    service = new SalesService();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await resetTestDb();
    user = await createTestUser();
    shift = await createTestShift(user.id);
  });

  const baseSale = (overrides: Record<string, unknown> = {}) => ({
    user_id: user.id,
    shift_id: shift.id,
    payment_method: 'cash' as const,
    ...overrides,
  });

  // ─── processSale ────────────────────────────────────────────────────────────

  describe('processSale', () => {
    it('venta feliz en efectivo: totales round2, stock decrementado, precio desde la BD', async () => {
      const product = await createTestProduct({ sale_price: 10.5, stock: 50 });

      const result = await service.processSale(
        baseSale({ discount_amount: 1.5, amount_paid: 50 }),
        [{ product_id: product.id, quantity: 3 }],
      );

      expect(result.success).toBe(true);
      expect(result.saleId).toMatch(/^[0-9A-Z]{8}$/);

      const sale = await getSale(result.saleId);
      expect(Number(sale.subtotal)).toBe(31.5);
      expect(Number(sale.discount_amount)).toBe(1.5);
      expect(Number(sale.total_amount)).toBe(30);
      expect(Number(sale.amount_paid)).toBe(50);
      expect(Number(sale.change_given)).toBe(20);
      expect(sale.status).toBe('paid');
      expect(sale.payment_method).toBe('cash');

      expect(sale.items).toHaveLength(1);
      expect(Number(sale.items[0].unit_price)).toBe(10.5);
      expect(Number(sale.items[0].total_price)).toBe(31.5);
      expect(sale.items[0].quantity).toBe(3);
      expect(sale.items[0].product_name).toBe(product.name);

      const updated = await getProduct(product.id);
      expect(updated.stock).toBe(47);
    });

    it('efectivo sin amount_paid usa el total exacto (cambio 0)', async () => {
      const product = await createTestProduct({ sale_price: 25, stock: 10 });
      const { saleId } = await service.processSale(baseSale(), [
        { product_id: product.id, quantity: 2 },
      ]);
      const sale = await getSale(saleId);
      expect(Number(sale.amount_paid)).toBe(50);
      expect(Number(sale.change_given)).toBe(0);
    });

    it('card/transfer fijan amount_paid = total y cambio 0 (ignora amount_paid del cliente)', async () => {
      const product = await createTestProduct({ sale_price: 40, stock: 10 });
      const { saleId } = await service.processSale(
        baseSale({ payment_method: 'card', amount_paid: 9999 }),
        [{ product_id: product.id, quantity: 1 }],
      );
      const sale = await getSale(saleId);
      expect(Number(sale.amount_paid)).toBe(40);
      expect(Number(sale.change_given)).toBe(0);
      expect(sale.status).toBe('paid');
    });

    it('rechaza venta sin items', async () => {
      await expect(service.processSale(baseSale(), [])).rejects.toThrow(/No items/);
    });

    it('rechaza cantidades no enteras o <= 0 sin tocar el stock', async () => {
      const product = await createTestProduct({ stock: 50 });
      for (const quantity of [1.5, 0, -2, NaN]) {
        await expect(
          service.processSale(baseSale(), [{ product_id: product.id, quantity }]),
        ).rejects.toThrow(/Cantidad inválida/);
      }
      expect((await getProduct(product.id)).stock).toBe(50);
    });

    it('rechaza stock insuficiente', async () => {
      const product = await createTestProduct({ stock: 2 });
      await expect(
        service.processSale(baseSale(), [{ product_id: product.id, quantity: 3 }]),
      ).rejects.toThrow(/Insufficient stock/);
      expect((await getProduct(product.id)).stock).toBe(2);
    });

    it('rechaza producto inexistente', async () => {
      await expect(
        service.processSale(baseSale(), [{ product_id: 'nope', quantity: 1 }]),
      ).rejects.toThrow(/Product not found/);
    });

    it('ignora el unit_price enviado por el cliente sin allowPriceOverride', async () => {
      const product = await createTestProduct({ sale_price: 100, stock: 10 });
      const { saleId } = await service.processSale(
        baseSale({ amount_paid: 100 }),
        [{ product_id: product.id, quantity: 1, unit_price: 1 }],
      );
      const sale = await getSale(saleId);
      expect(Number(sale.items[0].unit_price)).toBe(100);
      expect(Number(sale.total_amount)).toBe(100);
    });

    it('respeta el override de precio con allowPriceOverride', async () => {
      const product = await createTestProduct({ sale_price: 100, stock: 10 });
      const { saleId } = await service.processSale(
        baseSale({ amount_paid: 80 }),
        [{ product_id: product.id, quantity: 1, unit_price: 80 }],
        { allowPriceOverride: true },
      );
      const sale = await getSale(saleId);
      expect(Number(sale.items[0].unit_price)).toBe(80);
      expect(Number(sale.total_amount)).toBe(80);
    });

    it('rechaza override de precio negativo o no finito', async () => {
      const product = await createTestProduct({ sale_price: 100, stock: 10 });
      await expect(
        service.processSale(
          baseSale(),
          [{ product_id: product.id, quantity: 1, unit_price: -5 }],
          { allowPriceOverride: true },
        ),
      ).rejects.toThrow(/Precio unitario inválido/);
      await expect(
        service.processSale(
          baseSale(),
          [{ product_id: product.id, quantity: 1, unit_price: NaN }],
          { allowPriceOverride: true },
        ),
      ).rejects.toThrow(/Precio unitario inválido/);
    });

    it('ignora los totales enviados por el cliente (subtotal/total_amount) y calcula en servidor', async () => {
      const product = await createTestProduct({ sale_price: 100, stock: 10 });
      const { saleId } = await service.processSale(
        baseSale({ subtotal: 1, total_amount: 1, amount_paid: 100 }),
        [{ product_id: product.id, quantity: 1 }],
      );
      const sale = await getSale(saleId);
      expect(Number(sale.subtotal)).toBe(100);
      expect(Number(sale.total_amount)).toBe(100);
    });

    it('efectivo con amount_paid menor al total es rechazado y hace rollback (stock intacto, sin venta)', async () => {
      const product = await createTestProduct({ sale_price: 100, stock: 10 });
      await expect(
        service.processSale(
          baseSale({ amount_paid: 50 }),
          [{ product_id: product.id, quantity: 1 }],
        ),
      ).rejects.toThrow(/monto pagado es insuficiente/);
      expect((await getProduct(product.id)).stock).toBe(10);
      expect(await AppDataSource.getRepository(Sale).count()).toBe(0);
      expect(await AppDataSource.getRepository(SaleItem).count()).toBe(0);
    });

    it('rechaza descuento negativo y descuento mayor al subtotal', async () => {
      const product = await createTestProduct({ sale_price: 50, stock: 10 });
      await expect(
        service.processSale(
          baseSale({ discount_amount: -5 }),
          [{ product_id: product.id, quantity: 1 }],
        ),
      ).rejects.toThrow(/Discount amount cannot be negative/);
      await expect(
        service.processSale(
          baseSale({ discount_amount: 51 }),
          [{ product_id: product.id, quantity: 1 }],
        ),
      ).rejects.toThrow(/Discount cannot be greater/);
    });

    it('rechaza turno inexistente o cerrado', async () => {
      const product = await createTestProduct();
      await expect(
        service.processSale(
          baseSale({ shift_id: 'NOEXISTE' }),
          [{ product_id: product.id, quantity: 1 }],
        ),
      ).rejects.toThrow(/Shift is not open or invalid/);

      const closed = await createTestShift(user.id, { status: 'closed' });
      await expect(
        service.processSale(
          baseSale({ shift_id: closed.id }),
          [{ product_id: product.id, quantity: 1 }],
        ),
      ).rejects.toThrow(/Shift is not open or invalid/);
    });

    it('rechaza vender en el turno de otro usuario', async () => {
      const other = await createTestUser();
      const otherShift = await createTestShift(other.id);
      const product = await createTestProduct();
      await expect(
        service.processSale(
          baseSale({ shift_id: otherShift.id }),
          [{ product_id: product.id, quantity: 1 }],
        ),
      ).rejects.toThrow(/no pertenece al usuario/);
    });

    it('venta a crédito requiere cliente', async () => {
      const product = await createTestProduct();
      await expect(
        service.processSale(
          baseSale({ payment_method: 'credit' }),
          [{ product_id: product.id, quantity: 1 }],
        ),
      ).rejects.toThrow(/requieren un cliente/);
    });

    it('venta a crédito: incrementa balance, status credit, amount_paid 0', async () => {
      const product = await createTestProduct({ sale_price: 75.25, stock: 10 });
      const customer = await createTestCustomer({ balance: 10 });

      const { saleId } = await service.processSale(
        baseSale({ payment_method: 'credit', customer_id: customer.id }),
        [{ product_id: product.id, quantity: 2 }],
      );

      const sale = await getSale(saleId);
      expect(sale.status).toBe('credit');
      expect(Number(sale.amount_paid)).toBe(0);
      expect(Number(sale.change_given)).toBe(0);
      expect(Number(sale.total_amount)).toBe(150.5);
      expect(sale.customer_id).toBe(customer.id);
      expect(sale.customer_name).toBe(customer.name);

      const updated = await getCustomer(customer.id);
      expect(Number(updated.balance)).toBe(160.5);
    });

    it('venta a crédito con cliente inexistente rechazada', async () => {
      const product = await createTestProduct();
      await expect(
        service.processSale(
          baseSale({ payment_method: 'credit', customer_id: 'ghost' }),
          [{ product_id: product.id, quantity: 1 }],
        ),
      ).rejects.toThrow(/Cliente no encontrado/);
    });

    it('crédito que excede el límite es rechazado con el total del SERVIDOR (ignora el del cliente)', async () => {
      const product = await createTestProduct({ sale_price: 60, stock: 10 });
      const customer = await createTestCustomer({ balance: 50, credit_limit: 100 });

      await expect(
        service.processSale(
          // el cliente miente diciendo que el total es 1
          baseSale({ payment_method: 'credit', customer_id: customer.id, total_amount: 1 }),
          [{ product_id: product.id, quantity: 1 }],
        ),
      ).rejects.toThrow(/límite de crédito/);

      // rollback completo
      expect((await getProduct(product.id)).stock).toBe(10);
      expect(Number((await getCustomer(customer.id)).balance)).toBe(50);
    });

    it('crédito exactamente en el límite es aceptado', async () => {
      const product = await createTestProduct({ sale_price: 50, stock: 10 });
      const customer = await createTestCustomer({ balance: 50, credit_limit: 100 });
      const { saleId } = await service.processSale(
        baseSale({ payment_method: 'credit', customer_id: customer.id }),
        [{ product_id: product.id, quantity: 1 }],
      );
      expect(saleId).toBeTruthy();
      expect(Number((await getCustomer(customer.id)).balance)).toBe(100);
    });

    it('cliente sin límite (NULL) permite crédito ilimitado', async () => {
      const product = await createTestProduct({ sale_price: 10000, stock: 10 });
      const customer = await createTestCustomer({ balance: 0 });
      const { saleId } = await service.processSale(
        baseSale({ payment_method: 'credit', customer_id: customer.id }),
        [{ product_id: product.id, quantity: 1 }],
      );
      expect(saleId).toBeTruthy();
    });
  });

  // ─── voidSale ───────────────────────────────────────────────────────────────

  describe('voidSale', () => {
    it('marca voided y restaura el stock', async () => {
      const product = await createTestProduct({ sale_price: 20, stock: 10 });
      const { saleId } = await service.processSale(baseSale({ amount_paid: 40 }), [
        { product_id: product.id, quantity: 2 },
      ]);
      expect((await getProduct(product.id)).stock).toBe(8);

      const result = await service.voidSale(saleId);
      expect(result.success).toBe(true);
      expect((await getSale(saleId)).status).toBe('voided');
      expect((await getProduct(product.id)).stock).toBe(10);
    });

    it('no permite anular dos veces', async () => {
      const product = await createTestProduct();
      const { saleId } = await service.processSale(baseSale({ amount_paid: 100 }), [
        { product_id: product.id, quantity: 1 },
      ]);
      await service.voidSale(saleId);
      await expect(service.voidSale(saleId)).rejects.toThrow(/ya ha sido anulada/);
    });

    it('venta inexistente lanza error', async () => {
      await expect(service.voidSale('NOEXISTE')).rejects.toThrow(/no encontrada/);
    });

    it('crédito sin abonos: resta el total completo del balance', async () => {
      const product = await createTestProduct({ sale_price: 100, stock: 10 });
      const customer = await createTestCustomer();
      const { saleId } = await service.processSale(
        baseSale({ payment_method: 'credit', customer_id: customer.id }),
        [{ product_id: product.id, quantity: 1 }],
      );
      expect(Number((await getCustomer(customer.id)).balance)).toBe(100);

      await service.voidSale(saleId);
      expect(Number((await getCustomer(customer.id)).balance)).toBe(0);
    });

    it('crédito con abono parcial: solo resta el pendiente round2(total - amount_paid)', async () => {
      const product = await createTestProduct({ sale_price: 100, stock: 10 });
      const customer = await createTestCustomer();
      const { saleId } = await service.processSale(
        baseSale({ payment_method: 'credit', customer_id: customer.id }),
        [{ product_id: product.id, quantity: 1 }],
      );
      // Abono de 30 → balance 70, sale partial con amount_paid 30
      await service.payDebt(customer.id, 30, shift.id, 'cash', user.id);
      expect(Number((await getCustomer(customer.id)).balance)).toBe(70);

      await service.voidSale(saleId);
      // pendiente = 100 - 30 = 70 → balance queda en 0 (no negativo)
      expect(Number((await getCustomer(customer.id)).balance)).toBe(0);
      expect((await getProduct(product.id)).stock).toBe(10);
    });

    it('clampa el balance a >= 0 si el pendiente supera el balance actual', async () => {
      const product = await createTestProduct({ sale_price: 100, stock: 10 });
      const customer = await createTestCustomer();
      const { saleId } = await service.processSale(
        baseSale({ payment_method: 'credit', customer_id: customer.id }),
        [{ product_id: product.id, quantity: 1 }],
      );
      // Forzamos un balance inconsistente menor al pendiente
      await AppDataSource.getRepository(Customer).update({ id: customer.id }, { balance: 40 });

      await service.voidSale(saleId);
      expect(Number((await getCustomer(customer.id)).balance)).toBe(0);
    });

    it('crédito ya saldado (amount_paid = total): no toca el balance', async () => {
      const product = await createTestProduct({ sale_price: 100, stock: 10 });
      const customer = await createTestCustomer();
      const { saleId } = await service.processSale(
        baseSale({ payment_method: 'credit', customer_id: customer.id }),
        [{ product_id: product.id, quantity: 1 }],
      );
      await service.payDebt(customer.id, 100, shift.id, 'cash', user.id);
      expect(Number((await getCustomer(customer.id)).balance)).toBe(0);

      await service.voidSale(saleId);
      expect(Number((await getCustomer(customer.id)).balance)).toBe(0);
    });
  });

  // ─── listSales ──────────────────────────────────────────────────────────────

  describe('listSales', () => {
    it('devuelve el shape {items,total,page,pageSize,totalPages} y pagina', async () => {
      for (let i = 0; i < 5; i++) {
        await createTestSale({ user_id: user.id, total_amount: 10 + i });
      }
      const page1 = await service.listSales({ page: 1, pageSize: 2 });
      expect(page1).toMatchObject({ total: 5, page: 1, pageSize: 2, totalPages: 3 });
      expect(page1.items).toHaveLength(2);

      const page3 = await service.listSales({ page: 3, pageSize: 2 });
      expect(page3.items).toHaveLength(1);
    });

    it('sin resultados devuelve totalPages 1', async () => {
      const res = await service.listSales({});
      expect(res.items).toHaveLength(0);
      expect(res.total).toBe(0);
      expect(res.totalPages).toBe(1);
    });

    it('clampa page y pageSize inválidos', async () => {
      await createTestSale({ user_id: user.id, total_amount: 10 });
      const res = await service.listSales({ page: -3, pageSize: 99999 });
      expect(res.page).toBe(1);
      expect(res.pageSize).toBe(100);
    });

    it('filtra por búsqueda de id y de customer_name', async () => {
      const s1 = await createTestSale({ user_id: user.id, total_amount: 10 });
      await createTestSale({ user_id: user.id, total_amount: 20, customer_name: 'María Pérez' });

      const byId = await service.listSales({ search: s1.id });
      expect(byId.items.map(s => s.id)).toEqual([s1.id]);

      const byName = await service.listSales({ search: 'maría' });
      expect(byName.total).toBe(1);
      expect(byName.items[0].customer_name).toBe('María Pérez');
    });

    it('filtra por método y por estado; valores inválidos se ignoran', async () => {
      await createTestSale({ user_id: user.id, total_amount: 10, payment_method: 'cash' });
      await createTestSale({ user_id: user.id, total_amount: 20, payment_method: 'card' });
      await createTestSale({
        user_id: user.id,
        total_amount: 30,
        payment_method: 'credit',
        status: 'credit',
      });
      await createTestSale({ user_id: user.id, total_amount: 40, status: 'voided' });

      expect((await service.listSales({ method: 'card' })).total).toBe(1);
      expect((await service.listSales({ status: 'voided' })).total).toBe(1);
      expect((await service.listSales({ status: 'credit' })).total).toBe(1);
      // valores fuera del allowlist no filtran (y no rompen)
      expect((await service.listSales({ method: "'; DROP TABLE sales;--" })).total).toBe(4);
      expect((await service.listSales({ status: 'weird' })).total).toBe(4);
    });

    it('filtra por rango de fechas', async () => {
      await createTestSale({
        user_id: user.id,
        total_amount: 10,
        created_at: new Date('2020-01-15T12:00:00Z'),
      });
      await createTestSale({ user_id: user.id, total_amount: 20 });

      const recent = await service.listSales({ startDate: '2021-01-01' });
      expect(recent.total).toBe(1);
      expect(Number(recent.items[0].total_amount)).toBe(20);

      const old = await service.listSales({ endDate: '2020-12-31' });
      expect(old.total).toBe(1);
      expect(Number(old.items[0].total_amount)).toBe(10);

      const none = await service.listSales({ startDate: 'no-es-fecha' });
      expect(none.total).toBe(2); // fecha inválida se ignora
    });

    it('sanea el usuario en los resultados (sin password ni session_token)', async () => {
      await createTestSale({ user_id: user.id, total_amount: 10 });
      const res = await service.listSales({});
      const withUser = res.items[0];
      expect(withUser.user).toBeTruthy();
      expect((withUser.user as any).password).toBeUndefined();
      expect((withUser.user as any).session_token).toBeUndefined();
    });
  });

  // ─── payDebt ────────────────────────────────────────────────────────────────

  describe('payDebt', () => {
    async function customerWithDebt(total = 100) {
      const product = await createTestProduct({ sale_price: total, stock: 10 });
      const customer = await createTestCustomer();
      const { saleId } = await service.processSale(
        baseSale({ payment_method: 'credit', customer_id: customer.id }),
        [{ product_id: product.id, quantity: 1 }],
      );
      return { customer, saleId };
    }

    it('abono parcial: decrementa balance y marca la venta como partial', async () => {
      const { customer, saleId } = await customerWithDebt(100);
      const result = await service.payDebt(customer.id, 40, shift.id, 'cash', user.id);
      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(60);
      expect(result.payment.amount).toBe(40);
      expect(result.payment.payment_method).toBe('cash');
      expect(result.payment.shift_id).toBe(shift.id);

      const sale = await getSale(saleId);
      expect(sale.status).toBe('partial');
      expect(Number(sale.amount_paid)).toBe(40);

      const payments = await AppDataSource.getRepository(DebtPayment).find();
      expect(payments).toHaveLength(1);
    });

    it('abono total: la venta pasa a paid y el balance queda en 0', async () => {
      const { customer, saleId } = await customerWithDebt(100);
      await service.payDebt(customer.id, 40, shift.id, 'cash', user.id);
      const result = await service.payDebt(customer.id, 60, shift.id, 'transfer', user.id);
      expect(result.newBalance).toBe(0);

      const sale = await getSale(saleId);
      expect(sale.status).toBe('paid');
      expect(Number(sale.amount_paid)).toBe(100);
    });

    it('aplica el abono a las ventas pendientes más antiguas primero', async () => {
      const product = await createTestProduct({ sale_price: 50, stock: 10 });
      const customer = await createTestCustomer();
      const { saleId: first } = await service.processSale(
        baseSale({ payment_method: 'credit', customer_id: customer.id }),
        [{ product_id: product.id, quantity: 1 }],
      );
      // Segunda venta con fecha posterior garantizada
      const later = await createTestSale({
        user_id: user.id,
        customer_id: customer.id,
        payment_method: 'credit',
        status: 'credit',
        total_amount: 50,
        amount_paid: 0,
        created_at: new Date(Date.now() + 60_000),
      });
      await AppDataSource.getRepository(Customer).update({ id: customer.id }, { balance: 100 });

      await service.payDebt(customer.id, 70, shift.id, 'cash', user.id);

      const firstSale = await getSale(first);
      const secondSale = await getSale(later.id);
      expect(firstSale.status).toBe('paid');
      expect(Number(firstSale.amount_paid)).toBe(50);
      expect(secondSale.status).toBe('partial');
      expect(Number(secondSale.amount_paid)).toBe(20);
    });

    it('rechaza montos <= 0 o no numéricos', async () => {
      const { customer } = await customerWithDebt();
      for (const amount of [0, -10, NaN]) {
        await expect(
          service.payDebt(customer.id, amount, shift.id, 'cash', user.id),
        ).rejects.toThrow(/mayor a 0/);
      }
    });

    it('rechaza un monto mayor que la deuda', async () => {
      const { customer } = await customerWithDebt(100);
      await expect(
        service.payDebt(customer.id, 100.01, shift.id, 'cash', user.id),
      ).rejects.toThrow(/excede la deuda/);
    });

    it('rechaza cliente sin deuda y cliente inexistente', async () => {
      const clean = await createTestCustomer({ balance: 0 });
      await expect(
        service.payDebt(clean.id, 10, shift.id, 'cash', user.id),
      ).rejects.toThrow(/no tiene deuda/);
      await expect(service.payDebt('ghost', 10, shift.id, 'cash', user.id)).rejects.toThrow(
        /Cliente no encontrado/,
      );
    });

    it('rechaza método de pago inválido', async () => {
      const { customer } = await customerWithDebt();
      await expect(
        service.payDebt(customer.id, 10, shift.id, 'card' as never, user.id),
      ).rejects.toThrow(/Método de pago inválido/);
    });

    it('rechaza turno cerrado o inexistente', async () => {
      const { customer } = await customerWithDebt();
      const closed = await createTestShift(user.id, { status: 'closed' });
      await expect(
        service.payDebt(customer.id, 10, closed.id, 'cash', user.id),
      ).rejects.toThrow(/no existe o no está abierto/);
      await expect(
        service.payDebt(customer.id, 10, 'NOEXISTE', 'cash', user.id),
      ).rejects.toThrow(/no existe o no está abierto/);
    });

    it('rechaza abonar en el turno de otro usuario', async () => {
      const { customer } = await customerWithDebt();
      const other = await createTestUser();
      const otherShift = await createTestShift(other.id);
      await expect(
        service.payDebt(customer.id, 10, otherShift.id, 'cash', user.id),
      ).rejects.toThrow(/no pertenece al usuario/);
    });

    it('rechaza abono en EFECTIVO sin turno (el dinero debe entrar a un arqueo)', async () => {
      const { customer } = await customerWithDebt(100);
      await expect(
        service.payDebt(customer.id, 10, undefined, 'cash', user.id),
      ).rejects.toThrow(/Abre un turno/);
    });

    it('acepta transferencia sin turno (no afecta el efectivo de caja)', async () => {
      const { customer } = await customerWithDebt(100);
      const result = await service.payDebt(customer.id, 10, undefined, 'transfer', user.id);
      expect(result.newBalance).toBe(90);
      expect(result.payment.shift_id ?? null).toBeNull();
    });
  });

  // ─── Saneado de usuario en lecturas ─────────────────────────────────────────

  describe('saneado de usuario', () => {
    it('getSales, getRecentSales y findOne no exponen password ni session_token', async () => {
      const sale = await createTestSale({ user_id: user.id, total_amount: 10 });

      for (const s of await service.getSales()) {
        expect((s.user as any)?.password).toBeUndefined();
        expect((s.user as any)?.session_token).toBeUndefined();
      }
      for (const s of await service.getRecentSales()) {
        expect((s.user as any)?.password).toBeUndefined();
        expect((s.user as any)?.session_token).toBeUndefined();
      }
      const found = await service.findOne(sale.id);
      expect(found).toBeTruthy();
      expect((found!.user as any)?.password).toBeUndefined();
      expect((found!.user as any)?.session_token).toBeUndefined();
    });
  });
});
