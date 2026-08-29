import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initTestDb,
  closeTestDb,
  resetTestDb,
  createTestUser,
  createTestCustomer,
  createTestSale,
  createTestDebtPayment,
} from '../../../../test/db';
import { CustomersService } from './customers.service';
import type { User } from '@main/modules/users/entities/user.entity';

describe('CustomersService', () => {
  let service: CustomersService;
  let user: User;

  beforeAll(async () => {
    await initTestDb();
    service = new CustomersService();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await resetTestDb();
    user = await createTestUser();
  });

  // ─── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('crea con campos whitelisted recortados y balance SIEMPRE en 0', async () => {
      const customer = await service.create({
        name: '  Juan Pérez  ',
        phone: ' 809-555-0000 ',
        balance: 500, // intento de manipular deuda — debe ignorarse
      } as never);
      expect(customer.name).toBe('Juan Pérez');
      expect(customer.phone).toBe('809-555-0000');
      expect(Number(customer.balance)).toBe(0);
    });

    it('rechaza sin nombre y con campos no-string', async () => {
      await expect(service.create({})).rejects.toThrow(/nombre.*requerido/);
      await expect(service.create({ name: '   ' })).rejects.toThrow(/nombre.*requerido/);
      await expect(service.create({ name: 'X', phone: 123 as never })).rejects.toThrow(
        /Campo inválido: phone/,
      );
    });

    it('credit_limit requiere allowLimitEdit', async () => {
      await expect(service.create({ name: 'X', credit_limit: 100 })).rejects.toThrow(
        /Sin permiso para asignar límite/,
      );
      const ok = await service.create({ name: 'X', credit_limit: 100 }, { allowLimitEdit: true });
      expect(Number(ok.credit_limit)).toBe(100);
    });

    it('normalizeCreditLimit: inválidos rechazados, "" se convierte en null', async () => {
      await expect(
        service.create({ name: 'X', credit_limit: -5 }, { allowLimitEdit: true }),
      ).rejects.toThrow(/Límite de crédito inválido/);
      await expect(
        service.create({ name: 'X', credit_limit: 'abc' as never }, { allowLimitEdit: true }),
      ).rejects.toThrow(/Límite de crédito inválido/);
      const cleared = await service.create(
        { name: 'X', credit_limit: '' as never },
        { allowLimitEdit: true },
      );
      expect(cleared.credit_limit ?? null).toBeNull();
    });
  });

  // ─── update ─────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('actualiza campos whitelisted y nunca permite setear balance directo', async () => {
      const customer = await createTestCustomer({ balance: 40 });
      const updated = await service.update(customer.id, {
        name: 'Nuevo Nombre',
        notes: ' nota ',
        balance: 0, // intento de borrar deuda — debe ignorarse
      } as never);
      expect(updated.name).toBe('Nuevo Nombre');
      expect(updated.notes).toBe('nota');
      expect(Number(updated.balance)).toBe(40);
    });

    it('rechaza nombre vacío y cliente inexistente', async () => {
      const customer = await createTestCustomer();
      await expect(service.update(customer.id, { name: '  ' })).rejects.toThrow(/requerido/);
      await expect(service.update('ghost', { name: 'X' })).rejects.toThrow(/no encontrado/);
    });

    it('reenviar el MISMO límite sin permiso pasa; cambiarlo sin permiso falla', async () => {
      const customer = await createTestCustomer({ credit_limit: 100 });
      const same = await service.update(customer.id, { name: 'Y', credit_limit: 100 });
      expect(Number(same.credit_limit)).toBe(100);

      await expect(service.update(customer.id, { credit_limit: 200 })).rejects.toThrow(
        /Sin permiso para modificar el límite/,
      );

      const changed = await service.update(
        customer.id,
        { credit_limit: 200 },
        { allowLimitEdit: true },
      );
      expect(Number(changed.credit_limit)).toBe(200);
    });

    it('con permiso puede quitar el límite (null)', async () => {
      const customer = await createTestCustomer({ credit_limit: 100 });
      const updated = await service.update(
        customer.id,
        { credit_limit: null as never },
        { allowLimitEdit: true },
      );
      expect(updated.credit_limit ?? null).toBeNull();
    });

    it('límite inválido rechazado aunque haya permiso', async () => {
      const customer = await createTestCustomer();
      await expect(
        service.update(customer.id, { credit_limit: -1 }, { allowLimitEdit: true }),
      ).rejects.toThrow(/Límite de crédito inválido/);
    });
  });

  // ─── delete ─────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('bloqueado con deuda pendiente', async () => {
      const customer = await createTestCustomer({ balance: 10 });
      await expect(service.delete(customer.id)).rejects.toThrow(/deuda pendiente/);
    });

    it('bloqueado con ventas registradas (incluso anuladas)', async () => {
      const customer = await createTestCustomer();
      await createTestSale({
        user_id: user.id,
        customer_id: customer.id,
        total_amount: 10,
        status: 'voided',
      });
      await expect(service.delete(customer.id)).rejects.toThrow(/ventas registradas/);
    });

    it('elimina un cliente limpio; inexistente lanza', async () => {
      const customer = await createTestCustomer();
      await service.delete(customer.id);
      expect(await service.findOne(customer.id)).toBeNull();
      await expect(service.delete('ghost')).rejects.toThrow(/no encontrado/);
    });
  });

  // ─── list ───────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('shape {items,total,page,pageSize,totalPages} con agregados que excluyen anuladas', async () => {
      const buyer = await createTestCustomer({ name: 'Comprador' });
      await createTestCustomer({ name: 'Sin compras' });
      await createTestSale({ user_id: user.id, customer_id: buyer.id, total_amount: 100 });
      await createTestSale({ user_id: user.id, customer_id: buyer.id, total_amount: 50 });
      await createTestSale({
        user_id: user.id,
        customer_id: buyer.id,
        total_amount: 999,
        status: 'voided',
      });

      const res = await service.list({});
      expect(res).toMatchObject({ total: 2, page: 1, totalPages: 1 });

      const row = res.items.find(c => c.id === buyer.id)!;
      expect(row.purchases_count).toBe(2);
      expect(row.total_spent).toBe(150);
      expect(row.last_purchase_at).not.toBeNull();

      const empty = res.items.find(c => c.name === 'Sin compras')!;
      expect(empty.purchases_count).toBe(0);
      expect(empty.total_spent).toBe(0);
      expect(empty.last_purchase_at).toBeNull();
    });

    it('filtro debtors: solo balance > 0', async () => {
      const debtor = await createTestCustomer({ balance: 25 });
      await createTestCustomer({ balance: 0 });
      const res = await service.list({ filter: 'debtors' });
      expect(res.total).toBe(1);
      expect(res.items[0].id).toBe(debtor.id);
    });

    it('filtro credit: solo clientes con límite asignado', async () => {
      const withLimit = await createTestCustomer({ credit_limit: 500 });
      await createTestCustomer();
      const res = await service.list({ filter: 'credit' });
      expect(res.total).toBe(1);
      expect(res.items[0].id).toBe(withLimit.id);
    });

    it('filtro inactive: sin compras o con última compra > 30 días', async () => {
      const stale = await createTestCustomer({ name: 'Inactivo' });
      await createTestSale({
        user_id: user.id,
        customer_id: stale.id,
        total_amount: 10,
        created_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      });
      const never = await createTestCustomer({ name: 'Nunca compró' });
      const active = await createTestCustomer({ name: 'Activo' });
      await createTestSale({ user_id: user.id, customer_id: active.id, total_amount: 10 });

      const res = await service.list({ filter: 'inactive' });
      expect(res.total).toBe(2);
      const ids = res.items.map(c => c.id).sort();
      expect(ids).toEqual([stale.id, never.id].sort());
    });

    it('busca por nombre, teléfono o email', async () => {
      await createTestCustomer({ name: 'Pedro Gómez', phone: '809-111-2222' });
      await createTestCustomer({ name: 'Otra Persona', email: 'otra@mail.com' });
      expect((await service.list({ search: 'pedro' })).total).toBe(1);
      expect((await service.list({ search: '111-2222' })).total).toBe(1);
      expect((await service.list({ search: 'otra@mail' })).total).toBe(1);
      expect((await service.list({ search: 'nadie' })).total).toBe(0);
    });

    it('ordena por columnas permitidas y por agregados', async () => {
      const a = await createTestCustomer({ name: 'AAA', balance: 5 });
      const b = await createTestCustomer({ name: 'BBB', balance: 50 });
      await createTestSale({ user_id: user.id, customer_id: a.id, total_amount: 300 });

      const byBalance = await service.list({ sortBy: 'balance', sortOrder: 'DESC' });
      expect(byBalance.items[0].id).toBe(b.id);

      const bySpent = await service.list({ sortBy: 'total_spent', sortOrder: 'DESC' });
      expect(bySpent.items[0].id).toBe(a.id);
    });

    it('sortBy fuera del allowlist no rompe y usa el orden por defecto (name ASC)', async () => {
      await createTestCustomer({ name: 'Zeta' });
      await createTestCustomer({ name: 'Alfa' });
      const res = await service.list({ sortBy: 'evil; DROP TABLE customers;--' });
      expect(res.items.map(c => c.name)).toEqual(['Alfa', 'Zeta']);
    });

    it('pagina correctamente', async () => {
      for (const name of ['A', 'B', 'C']) await createTestCustomer({ name });
      const res = await service.list({ pageSize: 2, page: 2 });
      expect(res.totalPages).toBe(2);
      expect(res.items).toHaveLength(1);
      expect(res.items[0].name).toBe('C');
    });
  });

  // ─── getSummary ─────────────────────────────────────────────────────────────

  describe('getSummary', () => {
    it('números correctos: excluye anuladas, suma abonos, calcula crédito disponible', async () => {
      const customer = await createTestCustomer({ balance: 20, credit_limit: 100 });
      await createTestSale({ user_id: user.id, customer_id: customer.id, total_amount: 100 });
      await createTestSale({ user_id: user.id, customer_id: customer.id, total_amount: 50 });
      await createTestSale({
        user_id: user.id,
        customer_id: customer.id,
        total_amount: 999,
        status: 'voided',
      });
      await createTestDebtPayment({ customer_id: customer.id, amount: 30 });

      const summary = await service.getSummary(customer.id);
      expect(summary.purchasesCount).toBe(2);
      expect(summary.totalSpent).toBe(150);
      expect(summary.averageTicket).toBe(75);
      expect(summary.lastPurchaseAt).not.toBeNull();
      expect(summary.firstPurchaseAt).not.toBeNull();
      expect(summary.totalPaidDebt).toBe(30);
      expect(summary.paymentsCount).toBe(1);
      expect(summary.balance).toBe(20);
      expect(summary.creditLimit).toBe(100);
      expect(summary.creditAvailable).toBe(80);
    });

    it('cliente sin actividad ni límite: ceros y null', async () => {
      const customer = await createTestCustomer();
      const summary = await service.getSummary(customer.id);
      expect(summary.purchasesCount).toBe(0);
      expect(summary.totalSpent).toBe(0);
      expect(summary.averageTicket).toBe(0);
      expect(summary.creditLimit).toBeNull();
      expect(summary.creditAvailable).toBeNull();
    });

    it('cliente inexistente lanza', async () => {
      await expect(service.getSummary('ghost')).rejects.toThrow(/no encontrado/);
    });
  });

  // ─── getStats ───────────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('agrega deuda total, deudores y clientes activos (sin anuladas)', async () => {
      const d1 = await createTestCustomer({ balance: 30 });
      await createTestCustomer({ balance: 70.5 });
      const clean = await createTestCustomer({ balance: 0 });
      await createTestSale({ user_id: user.id, customer_id: clean.id, total_amount: 10 });
      await createTestSale({
        user_id: user.id,
        customer_id: d1.id,
        total_amount: 10,
        status: 'voided',
      });

      const stats = await service.getStats();
      expect(stats.totalCustomers).toBe(3);
      expect(stats.customersWithDebt).toBe(2);
      expect(stats.totalDebt).toBe(100.5);
      expect(stats.newThisMonth).toBe(3);
      expect(stats.activeThisMonth).toBe(1); // solo la venta no anulada de "clean"
    });
  });
});
