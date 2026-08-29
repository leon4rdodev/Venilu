import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initTestDb,
  closeTestDb,
  resetTestDb,
  createTestUser,
  createTestShift,
  createTestCustomer,
  createTestSale,
  createTestDebtPayment,
} from '../../../../test/db';
import { ShiftsService } from './shifts.service';
import type { User } from '@main/modules/users/entities/user.entity';

describe('ShiftsService', () => {
  let service: ShiftsService;
  let user: User;

  beforeAll(async () => {
    await initTestDb();
    service = new ShiftsService();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await resetTestDb();
    user = await createTestUser();
  });

  // ─── createShift ────────────────────────────────────────────────────────────

  describe('createShift', () => {
    it('crea un turno abierto con el monto inicial redondeado', async () => {
      const shift = await service.createShift(user.id, 1500.005);
      expect(shift.status).toBe('open');
      expect(shift.user_id).toBe(user.id);
      expect(Number(shift.initial_cash)).toBe(1500.01);
      expect(shift.id).toMatch(/^[0-9A-Z]{8}$/);
    });

    it('acepta monto inicial 0', async () => {
      const shift = await service.createShift(user.id, 0);
      expect(Number(shift.initial_cash)).toBe(0);
    });

    it('rechaza montos inválidos (negativo, NaN, no numérico)', async () => {
      await expect(service.createShift(user.id, -1)).rejects.toThrow(/inválido/);
      await expect(service.createShift(user.id, NaN)).rejects.toThrow(/inválido/);
      await expect(service.createShift(user.id, 'abc' as never)).rejects.toThrow(/inválido/);
    });

    it('no permite dos turnos abiertos para el mismo usuario', async () => {
      await service.createShift(user.id, 100);
      await expect(service.createShift(user.id, 100)).rejects.toThrow(/already has an active shift/);
    });

    it('otro usuario sí puede abrir su propio turno en paralelo', async () => {
      await service.createShift(user.id, 100);
      const other = await createTestUser();
      const shift = await service.createShift(other.id, 200);
      expect(shift.user_id).toBe(other.id);
    });
  });

  // ─── closeShift ─────────────────────────────────────────────────────────────

  describe('closeShift', () => {
    it('expected_cash = inicial + ventas cash + abonos cash − gastos; difference correcto', async () => {
      const shift = await createTestShift(user.id, { initial_cash: 1000 });
      const customer = await createTestCustomer();

      // Cuenta: venta cash 500
      await createTestSale({ user_id: user.id, shift_id: shift.id, total_amount: 500, payment_method: 'cash' });
      // NO cuentan: card, credit, cash anulada
      await createTestSale({ user_id: user.id, shift_id: shift.id, total_amount: 300, payment_method: 'card' });
      await createTestSale({ user_id: user.id, shift_id: shift.id, total_amount: 200, payment_method: 'credit', status: 'credit' });
      await createTestSale({ user_id: user.id, shift_id: shift.id, total_amount: 999, payment_method: 'cash', status: 'voided' });
      // Abonos: cash 200 cuenta, transfer 80 no
      await createTestDebtPayment({ customer_id: customer.id, shift_id: shift.id, amount: 200, payment_method: 'cash' });
      await createTestDebtPayment({ customer_id: customer.id, shift_id: shift.id, amount: 80, payment_method: 'transfer' });
      // Gasto 100
      await service.addExpense(shift.id, 100, 'Compra de hielo', user.id);

      const closed = await service.closeShift(shift.id, 1550, user.id);

      // 1000 + 500 + 200 - 100 = 1600
      expect(Number(closed.expected_cash)).toBe(1600);
      expect(Number(closed.final_cash)).toBe(1550);
      expect(Number(closed.difference)).toBe(-50);
      expect(closed.status).toBe('closed');
      expect(closed.end_time).toBeTruthy();
    });

    it('redondea final_cash y difference a 2 decimales', async () => {
      const shift = await createTestShift(user.id, { initial_cash: 100 });
      const closed = await service.closeShift(shift.id, 100.005, user.id);
      expect(Number(closed.final_cash)).toBe(100.01);
      expect(Number(closed.expected_cash)).toBe(100);
      expect(Number(closed.difference)).toBe(0.01);
    });

    it('rechaza monto final inválido', async () => {
      const shift = await createTestShift(user.id);
      await expect(service.closeShift(shift.id, -5, user.id)).rejects.toThrow(/inválido/);
      await expect(service.closeShift(shift.id, NaN, user.id)).rejects.toThrow(/inválido/);
    });

    it('otro usuario no puede cerrar el turno (ownership)', async () => {
      const shift = await createTestShift(user.id);
      const other = await createTestUser();
      await expect(service.closeShift(shift.id, 1000, other.id)).rejects.toThrow(
        /Solo puedes cerrar tu propio turno/,
      );
    });

    it('turno inexistente o ya cerrado', async () => {
      await expect(service.closeShift('NOEXISTE', 100, user.id)).rejects.toThrow(/not found/);
      const shift = await createTestShift(user.id);
      await service.closeShift(shift.id, 1000, user.id);
      await expect(service.closeShift(shift.id, 1000, user.id)).rejects.toThrow(/ya está cerrado/);
    });
  });

  // ─── addExpense ─────────────────────────────────────────────────────────────

  describe('addExpense', () => {
    it('registra un gasto válido con motivo recortado', async () => {
      const shift = await createTestShift(user.id);
      const expense = await service.addExpense(shift.id, 50.505, '  Gasolina  ', user.id);
      expect(Number(expense.amount)).toBe(50.51);
      expect(expense.reason).toBe('Gasolina');
      expect(expense.shift_id).toBe(shift.id);
    });

    it('rechaza monto <= 0 o no numérico', async () => {
      const shift = await createTestShift(user.id);
      await expect(service.addExpense(shift.id, 0, 'x', user.id)).rejects.toThrow(/mayor a 0/);
      await expect(service.addExpense(shift.id, -10, 'x', user.id)).rejects.toThrow(/mayor a 0/);
      await expect(service.addExpense(shift.id, NaN, 'x', user.id)).rejects.toThrow(/mayor a 0/);
    });

    it('rechaza motivo vacío o no string', async () => {
      const shift = await createTestShift(user.id);
      await expect(service.addExpense(shift.id, 10, '   ', user.id)).rejects.toThrow(/motivo/);
      await expect(service.addExpense(shift.id, 10, null as never, user.id)).rejects.toThrow(/motivo/);
    });

    it('rechaza turno cerrado o inexistente', async () => {
      const closed = await createTestShift(user.id, { status: 'closed' });
      await expect(service.addExpense(closed.id, 10, 'x', user.id)).rejects.toThrow(
        /No hay un turno abierto/,
      );
      await expect(service.addExpense('NOEXISTE', 10, 'x', user.id)).rejects.toThrow(
        /No hay un turno abierto/,
      );
    });

    it('otro usuario no puede registrar gastos en el turno (ownership)', async () => {
      const shift = await createTestShift(user.id);
      const other = await createTestUser();
      await expect(service.addExpense(shift.id, 10, 'x', other.id)).rejects.toThrow(
        /tu propio turno/,
      );
    });
  });

  // ─── getActiveShift / getLastClosedShift ────────────────────────────────────

  describe('getActiveShift', () => {
    it('devuelve el turno abierto del usuario o null', async () => {
      expect(await service.getActiveShift(user.id)).toBeNull();
      const shift = await createTestShift(user.id);
      expect((await service.getActiveShift(user.id))?.id).toBe(shift.id);
    });
  });

  describe('getLastClosedShift', () => {
    it('devuelve el turno cerrado más reciente DEL usuario', async () => {
      const older = await createTestShift(user.id, {
        status: 'closed',
        end_time: new Date('2024-01-01T10:00:00Z'),
        final_cash: 100,
      });
      const newer = await createTestShift(user.id, {
        status: 'closed',
        end_time: new Date('2024-06-01T10:00:00Z'),
        final_cash: 200,
      });
      // turno cerrado más reciente pero de OTRO usuario — no debe devolverse
      const other = await createTestUser();
      await createTestShift(other.id, {
        status: 'closed',
        end_time: new Date('2025-01-01T10:00:00Z'),
      });
      // turno abierto no cuenta
      await createTestShift(user.id, { status: 'open' });

      const last = await service.getLastClosedShift(user.id);
      expect(last?.id).toBe(newer.id);
      expect(last?.id).not.toBe(older.id);
    });

    it('devuelve null si el usuario nunca ha cerrado un turno', async () => {
      await createTestShift(user.id, { status: 'open' });
      expect(await service.getLastClosedShift(user.id)).toBeNull();
    });
  });

  // ─── assertShiftAccess ──────────────────────────────────────────────────────

  describe('assertShiftAccess', () => {
    it('permite al dueño y a quien puede ver turnos ajenos; bloquea al resto', async () => {
      const shift = await createTestShift(user.id);
      const other = await createTestUser();

      await expect(service.assertShiftAccess(shift.id, user.id, false)).resolves.toBeUndefined();
      await expect(service.assertShiftAccess(shift.id, other.id, true)).resolves.toBeUndefined();
      await expect(service.assertShiftAccess(shift.id, other.id, false)).rejects.toThrow(
        /No tienes acceso/,
      );
      await expect(service.assertShiftAccess('NOEXISTE', user.id, false)).rejects.toThrow(
        /Turno no encontrado/,
      );
    });
  });

  // ─── forceClose ─────────────────────────────────────────────────────────────

  describe('forceClose', () => {
    it('un admin cierra el turno de otro usuario con auditoría y expected_cash correcto', async () => {
      const admin = await createTestUser({ role: 'admin' });
      const shift = await createTestShift(user.id, { initial_cash: 500 });
      await createTestSale({ user_id: user.id, shift_id: shift.id, total_amount: 250, payment_method: 'cash' });

      const closed = await service.forceClose(shift.id, 700, admin.id, 'Empleado ausente');

      expect(closed.status).toBe('closed');
      expect(closed.force_closed).toBe(true);
      expect(closed.force_closed_by).toBe(admin.id);
      expect(closed.force_close_reason).toBe('Empleado ausente');
      expect(Number(closed.expected_cash)).toBe(750);
      expect(Number(closed.difference)).toBe(-50);
    });

    it('rechaza monto inválido, turno inexistente y turno ya cerrado', async () => {
      const admin = await createTestUser({ role: 'admin' });
      const shift = await createTestShift(user.id);
      await expect(service.forceClose(shift.id, -1, admin.id)).rejects.toThrow(/inválido/);
      await expect(service.forceClose('NOEXISTE', 100, admin.id)).rejects.toThrow(/no encontrado/);
      await service.forceClose(shift.id, 1000, admin.id);
      await expect(service.forceClose(shift.id, 1000, admin.id)).rejects.toThrow(/ya está cerrado/);
    });
  });

  // ─── getShiftsHistory ───────────────────────────────────────────────────────

  describe('getShiftsHistory', () => {
    it('expone user_name pero nunca el hash de contraseña; filtra por usuario', async () => {
      const other = await createTestUser();
      await createTestShift(user.id);
      await createTestShift(other.id);

      const all = await service.getShiftsHistory();
      expect(all).toHaveLength(2);
      for (const row of all) {
        expect(row.user_name).toBeTruthy();
        expect(row.user).toBeUndefined();
        expect(JSON.stringify(row)).not.toContain('$2'); // ningún hash bcrypt filtrado
      }

      const mine = await service.getShiftsHistory(user.id);
      expect(mine).toHaveLength(1);
      expect(mine[0].user_id).toBe(user.id);
    });
  });
});
