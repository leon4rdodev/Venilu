import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  initTestDb, closeTestDb, resetTestDb,
  createTestUser, createTestProduct, createTestShift,
} from '../../../../test/db';
import { escribirP12 } from '../../../../test/ecf-cert';
import { AppDataSource } from '@main/config/data-source';
import { Setting } from '@main/modules/settings/entities/setting.entity';
import { Sale } from '@main/modules/sales/entities/sale.entity';
import { FiscalService } from '@main/modules/fiscal/services/fiscal.service';
import { SalesService } from '@main/modules/sales/services/sales.service';
import { EcfDocument } from '../entities/ecf-document.entity';
import { EcfContingencia } from '../entities/ecf-contingencia.entity';
import { contingenciaService, LIMITE_DIAS_CONTINGENCIA } from './contingencia';
import { ecfService } from './ecf.service';
import { firmarDocumento } from './emision';
import { validateEcf, formatIssues } from '../xml/xsd-validator';

const RNC = '131880738';

describe('Contingencia por imposibilidad técnica (Informe Técnico §19.2)', () => {
  const fiscal = new FiscalService();
  const sales = new SalesService();

  beforeAll(async () => { await initTestDb(); });
  afterAll(async () => { await closeTestDb(); });
  beforeEach(async () => { await resetTestDb(); });

  async function preparar({ conB = true } = {}) {
    const repo = AppDataSource.getRepository(Setting);
    await repo.save(repo.create({
      id: 1, business_name: 'COLMADO PRUEBA SRL', business_address: 'Calle 1 #2',
      business_tax_id: RNC, paper_size: '80mm', fiscal_enabled: true, itbis_rate: 18,
    }));
    await fiscal.saveSequence({ type: '32', from_number: 1, to_number: 100 });
    await fiscal.saveSequence({ type: '34', from_number: 1, to_number: 100 });
    if (conB) {
      await fiscal.saveSequence({ type: 'B02', from_number: 1, to_number: 50, expires_at: '2099-12-31' });
      await fiscal.saveSequence({ type: 'B04', from_number: 1, to_number: 50, expires_at: '2099-12-31' });
    }
    const user = await createTestUser();
    const shift = await createTestShift(user.id);
    const producto = await createTestProduct({ sale_price: 118, stock: 50 });
    return { user, shift, producto };
  }

  const vender = (userId: string, shiftId: string, productId: string, qty = 1) =>
    sales.processSale(
      { user_id: userId, shift_id: shiftId, payment_method: 'cash', amount_paid: 10_000, fiscal: { ncfType: '32' } },
      [{ product_id: productId, quantity: qty }],
    );

  it('no se puede iniciar sin secuencias serie B vigentes', async () => {
    await preparar({ conB: false });
    await expect(contingenciaService.iniciar('Servidor de firma caído')).rejects.toThrow(/serie B/);
  });

  it('durante la contingencia la venta recibe un NCF B02 y ningún e-CF', async () => {
    const { user, shift, producto } = await preparar();
    await contingenciaService.iniciar('Falla del certificado digital');

    const r = await vender(user.id, shift.id, producto.id);
    expect(r.ncf).toBe('B0200000001');
    const venta = await AppDataSource.getRepository(Sale).findOneBy({ id: r.saleId });
    expect(venta!.ncf_type).toBe('B02');
    expect(await AppDataSource.getRepository(EcfDocument).count()).toBe(0);

    const estado = await contingenciaService.estado();
    expect(estado.activa?.motivo).toBe('Falla del certificado digital');
    expect(estado.dias).toBe(0);
    expect(estado.excede_limite).toBe(false);
  });

  it('avisa cuando la contingencia supera los 15 días', async () => {
    await preparar();
    await contingenciaService.iniciar('Falla prolongada');
    const dentro16 = new Date(Date.now() + (LIMITE_DIAS_CONTINGENCIA + 1) * 86_400_000);
    const estado = await contingenciaService.estado(dentro16);
    expect(estado.excede_limite).toBe(true);
  });

  it('al finalizar genera e-CF de reemplazo con código 4 para la venta y la devolución', async () => {
    const { user, shift, producto } = await preparar();

    // Venta e-CF normal ANTES de la contingencia: no se toca.
    const antes = await vender(user.id, shift.id, producto.id);
    expect(antes.ncf).toBe('E320000000001');

    await contingenciaService.iniciar('Sin acceso al certificado');
    const enCont = await vender(user.id, shift.id, producto.id, 2);
    const items = await sales.getSaleItems(enCont.saleId!);
    const dev = await sales.processReturn(enCont.saleId!, [{ sale_item_id: items[0].id!, quantity: 1 }], user.id);
    expect(dev.creditNoteNcf).toBe('B0400000001');

    const { reemplazos } = await contingenciaService.finalizar('Certificado restablecido');
    expect(reemplazos).toEqual({ creados: 2, errores: [] });
    expect(await fiscal.contingenciaAbierta()).toBeNull();

    const docs = await AppDataSource.getRepository(EcfDocument).find({ order: { tipo: 'ASC' } });
    const reemplazoVenta = docs.find((d) => d.ncf_reemplazado === 'B0200000001')!;
    const reemplazoNc = docs.find((d) => d.ncf_reemplazado === 'B0400000001')!;
    expect(reemplazoVenta).toMatchObject({ tipo: 32, encf: 'E320000000002', estado: 'draft' });
    expect(reemplazoNc).toMatchObject({ tipo: 34, encf: 'E340000000001', estado: 'draft' });
    expect(Number(reemplazoNc.monto_total)).toBe(118);

    // Idempotente: no duplica.
    expect(await contingenciaService.generarReemplazos()).toEqual({ creados: 0, errores: [] });
    expect((await contingenciaService.estado()).pendientes_reemplazo).toBe(0);
  });

  it('el e-CF de reemplazo se firma con InformacionReferencia código 4 y valida contra el XSD', async () => {
    const { user, shift, producto } = await preparar();
    await ecfService.guardarConfig({ cert_path: escribirP12(RNC, 'clave'), cert_password: 'clave' });

    await contingenciaService.iniciar('Falla técnica');
    await vender(user.id, shift.id, producto.id);
    await contingenciaService.finalizar('Resuelta');

    const doc = await AppDataSource.getRepository(EcfDocument).findOneByOrFail({ ncf_reemplazado: 'B0200000001' });
    const firmado = await firmarDocumento(doc.id);
    expect(firmado.estado).toBe('signed');
    expect(firmado.signed_xml).toContain('<NCFModificado>B0200000001</NCFModificado>');
    expect(firmado.signed_xml).toContain('<CodigoModificacion>4</CodigoModificacion>');
    const check = validateEcf(firmado.signed_xml!, 32, { requireSignature: true });
    expect(check.valid, formatIssues(check)).toBe(true);
  });

  it('las ventas B anteriores al e-CF (papel histórico) no se reemplazan', async () => {
    const { user } = await preparar();
    await AppDataSource.getRepository(Sale).save(AppDataSource.getRepository(Sale).create({
      id: 'HIST01', user_id: user.id, payment_method: 'cash', subtotal: 100, discount_amount: 0,
      total_amount: 100, amount_paid: 100, change_given: 0, status: 'paid',
      ncf: 'B0200000999', ncf_type: 'B02', created_at: new Date('2025-01-10T10:00:00Z'),
    } as Partial<Sale>));
    await AppDataSource.getRepository(EcfContingencia).save({
      desde: new Date('2026-10-01T10:00:00Z'), hasta: new Date('2026-10-02T10:00:00Z'), motivo: 'prueba',
    });
    expect(await contingenciaService.pendientesReemplazo()).toEqual([]);
  });
});
