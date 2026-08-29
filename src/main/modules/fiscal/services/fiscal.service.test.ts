import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initTestDb, closeTestDb, resetTestDb,
  createTestUser, createTestProduct, createTestCustomer, createTestShift,
} from '../../../../test/db';
import { AppDataSource } from '@main/config/data-source';
import { NcfSequence } from '../entities/ncf-sequence.entity';
import { Setting } from '@main/modules/settings/entities/setting.entity';
import { Sale } from '@main/modules/sales/entities/sale.entity';
import { SaleItem } from '@main/modules/sales/entities/sale-item.entity';
import {
  FiscalService, formatNcf, isValidRncOrCedula, itbisIncludedIn,
} from './fiscal.service';
import { SalesService } from '@main/modules/sales/services/sales.service';

describe('Fiscal — helpers puros', () => {
  it('formatNcf produce tipo + 8 dígitos', () => {
    expect(formatNcf('B02', 143)).toBe('B0200000143');
    expect(formatNcf('B01', 99999999)).toBe('B0199999999');
  });

  it('valida RNC (9) y cédula (11), con o sin guiones', () => {
    expect(isValidRncOrCedula('130123456')).toBe(true);
    expect(isValidRncOrCedula('001-1234567-8')).toBe(true);
    expect(isValidRncOrCedula('12345')).toBe(false);
    expect(isValidRncOrCedula('abcdefghi')).toBe(false);
    expect(isValidRncOrCedula('')).toBe(false);
  });

  it('ITBIS incluido: 18% sobre precio con impuesto (118 → 18)', () => {
    expect(itbisIncludedIn(118, 18)).toBe(18);
    expect(itbisIncludedIn(100, 18)).toBe(15.25);
    expect(itbisIncludedIn(100, 0)).toBe(0);
  });
});

describe('Fiscal — secuencias y ventas con NCF', () => {
  const fiscal = new FiscalService();
  const sales = new SalesService();

  beforeAll(async () => { await initTestDb(); });
  afterAll(async () => { await closeTestDb(); });
  beforeEach(async () => { await resetTestDb(); });

  async function enableFiscal() {
    const repo = AppDataSource.getRepository(Setting);
    await repo.save(repo.create({ id: 1, business_name: 'Test', paper_size: '80mm', fiscal_enabled: true, itbis_rate: 18 }));
  }

  async function seq(type: 'B01' | 'B02' | 'B04', over: Partial<NcfSequence> = {}) {
    return fiscal.saveSequence({ type, from_number: 1, to_number: 100, ...over } as never);
  }

  async function setupSale() {
    const user = await createTestUser();
    const shift = await createTestShift(user.id);
    const gravado = await createTestProduct({ sale_price: 118, stock: 50 });
    const exento = await createTestProduct({ sale_price: 100, stock: 50, itbis_exempt: true });
    return { user, shift, gravado, exento };
  }

  it('venta B02: asigna NCF secuencial y calcula ITBIS solo del gravado', async () => {
    await enableFiscal();
    await seq('B02');
    const { user, shift, gravado, exento } = await setupSale();

    const r1 = await sales.processSale(
      { user_id: user.id, shift_id: shift.id, payment_method: 'cash', amount_paid: 1000, fiscal: { ncfType: 'B02' } },
      [{ product_id: gravado.id, quantity: 1 }, { product_id: exento.id, quantity: 1 }],
    );
    expect(r1.ncf).toBe('B0200000001');

    const sale = await AppDataSource.getRepository(Sale).findOneBy({ id: r1.saleId });
    expect(sale!.ncf_type).toBe('B02');
    // total 218: gravado 118 (ITBIS 18) + exento 100 (0)
    expect(Number(sale!.itbis_amount)).toBe(18);

    const items = await AppDataSource.getRepository(SaleItem).find({ where: { sale_id: r1.saleId } });
    const byProd = new Map(items.map(i => [i.product_id, Number(i.itbis_amount)]));
    expect(byProd.get(gravado.id)).toBe(18);
    expect(byProd.get(exento.id)).toBe(0);

    // Segundo comprobante: número siguiente
    const r2 = await sales.processSale(
      { user_id: user.id, shift_id: shift.id, payment_method: 'cash', amount_paid: 1000, fiscal: { ncfType: 'B02' } },
      [{ product_id: gravado.id, quantity: 1 }],
    );
    expect(r2.ncf).toBe('B0200000002');
  });

  it('venta sin solicitud fiscal: no consume NCF pero sí registra ITBIS', async () => {
    await enableFiscal();
    await seq('B02');
    const { user, shift, gravado } = await setupSale();

    const r = await sales.processSale(
      { user_id: user.id, shift_id: shift.id, payment_method: 'cash', amount_paid: 1000 },
      [{ product_id: gravado.id, quantity: 2 }],
    );
    expect(r.ncf ?? null).toBeNull();
    const sale = await AppDataSource.getRepository(Sale).findOneBy({ id: r.saleId });
    expect(sale!.ncf ?? null).toBeNull();
    expect(Number(sale!.itbis_amount)).toBe(36);
    const s = (await fiscal.listSequences())[0];
    expect(s.next_number).toBe(1); // intacta
  });

  it('B01 exige RNC/cédula válidos y los guarda normalizados', async () => {
    await enableFiscal();
    await seq('B01');
    const { user, shift, gravado } = await setupSale();
    const base = { user_id: user.id, shift_id: shift.id, payment_method: 'cash' as const, amount_paid: 1000 };

    await expect(sales.processSale(
      { ...base, fiscal: { ncfType: 'B01' } },
      [{ product_id: gravado.id, quantity: 1 }],
    )).rejects.toThrow(/RNC/);

    const r = await sales.processSale(
      { ...base, fiscal: { ncfType: 'B01', customerRnc: '130-12345-6'.replace('-', '') + '', customerName: 'Empresa X SRL' } },
      [{ product_id: gravado.id, quantity: 1 }],
    );
    const sale = await AppDataSource.getRepository(Sale).findOneBy({ id: r.saleId });
    expect(sale!.ncf).toBe('B0100000001');
    expect(sale!.fiscal_customer_rnc).toMatch(/^\d{9}$/);
    expect(sale!.fiscal_customer_name).toBe('Empresa X SRL');
  });

  it('rechaza NCF con la facturación fiscal desactivada', async () => {
    const { user, shift, gravado } = await setupSale();
    await expect(sales.processSale(
      { user_id: user.id, shift_id: shift.id, payment_method: 'cash', amount_paid: 1000, fiscal: { ncfType: 'B02' } },
      [{ product_id: gravado.id, quantity: 1 }],
    )).rejects.toThrow(/no está activada/);
  });

  it('secuencia agotada o vencida: la venta con NCF no procede (y no toca stock)', async () => {
    await enableFiscal();
    await seq('B02', { from_number: 5, to_number: 5, next_number: 6 } as never); // agotada
    const { user, shift, gravado } = await setupSale();

    await expect(sales.processSale(
      { user_id: user.id, shift_id: shift.id, payment_method: 'cash', amount_paid: 1000, fiscal: { ncfType: 'B02' } },
      [{ product_id: gravado.id, quantity: 1 }],
    )).rejects.toThrow(/AGOTÓ/);

    await resetTestDb();
    await enableFiscal();
    await seq('B02', { expires_at: '2020-01-01' } as never); // vencida
    const ctx = await setupSale();
    await expect(sales.processSale(
      { user_id: ctx.user.id, shift_id: ctx.shift.id, payment_method: 'cash', amount_paid: 1000, fiscal: { ncfType: 'B02' } },
      [{ product_id: ctx.gravado.id, quantity: 1 }],
    )).rejects.toThrow(/VENCIDA/);

    // rollback: stock intacto
    const prod = await AppDataSource.getRepository('Product' as never).findOneBy({ id: ctx.gravado.id } as never) as { stock: number };
    expect(Number(prod.stock)).toBe(50);
  });

  it('descuento a nivel de venta: ITBIS prorrateado', async () => {
    await enableFiscal();
    await seq('B02');
    const { user, shift, gravado } = await setupSale();

    // 118 con ITBIS 18; descuento 59 (50%) → ITBIS 9
    const r = await sales.processSale(
      { user_id: user.id, shift_id: shift.id, payment_method: 'cash', amount_paid: 1000, discount_amount: 59, fiscal: { ncfType: 'B02' } },
      [{ product_id: gravado.id, quantity: 1 }],
    );
    const sale = await AppDataSource.getRepository(Sale).findOneBy({ id: r.saleId });
    expect(Number(sale!.total_amount)).toBe(59);
    expect(Number(sale!.itbis_amount)).toBe(9);
  });

  it('anular una venta con NCF emite Nota de Crédito B04 (y sin secuencia B04 bloquea)', async () => {
    await enableFiscal();
    await seq('B02');
    const { user, shift, gravado } = await setupSale();
    const { saleId } = await sales.processSale(
      { user_id: user.id, shift_id: shift.id, payment_method: 'cash', amount_paid: 1000, fiscal: { ncfType: 'B02' } },
      [{ product_id: gravado.id, quantity: 1 }],
    );

    // Sin B04 configurada → anulación bloqueada
    await expect(sales.voidSale(saleId)).rejects.toThrow(/B04/);
    let sale = await AppDataSource.getRepository(Sale).findOneBy({ id: saleId });
    expect(sale!.status).not.toBe('voided');

    await seq('B04');
    await sales.voidSale(saleId);
    sale = await AppDataSource.getRepository(Sale).findOneBy({ id: saleId });
    expect(sale!.status).toBe('voided');
    expect(sale!.credit_note_ncf).toBe('B0400000001');
  });

  it('anular una venta SIN NCF no consume B04', async () => {
    await enableFiscal();
    await seq('B04');
    const { user, shift, gravado } = await setupSale();
    const { saleId } = await sales.processSale(
      { user_id: user.id, shift_id: shift.id, payment_method: 'cash', amount_paid: 1000 },
      [{ product_id: gravado.id, quantity: 1 }],
    );
    await sales.voidSale(saleId);
    const b04 = (await fiscal.listSequences()).find(s => s.type === 'B04')!;
    expect(b04.next_number).toBe(1);
  });

  it('CRUD de secuencias: validación de rango y desactivar en vez de borrar si ya emitió', async () => {
    await expect(seq('B02', { from_number: 10, to_number: 5 } as never)).rejects.toThrow(/Rango/);

    const s = await seq('B02');
    expect((await fiscal.listSequences())[0].remaining).toBe(100);

    // simula emisión y luego "borrar" → queda desactivada
    const repo = AppDataSource.getRepository(NcfSequence);
    const row = await repo.findOneBy({ id: s.id });
    row!.next_number = 3;
    await repo.save(row!);
    await fiscal.deleteSequence(s.id);
    const after = await repo.findOneBy({ id: s.id });
    expect(after).not.toBeNull();
    expect(after!.active).toBe(false);
  });
});
