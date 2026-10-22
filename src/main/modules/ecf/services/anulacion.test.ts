import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { initTestDb, closeTestDb, resetTestDb, createTestUser, createTestProduct, createTestShift } from '../../../../test/db';
import { escribirP12 } from '../../../../test/ecf-cert';
import { AppDataSource } from '@main/config/data-source';
import { Setting } from '@main/modules/settings/entities/setting.entity';
import { FiscalService } from '@main/modules/fiscal/services/fiscal.service';
import { SalesService } from '@main/modules/sales/services/sales.service';
import { ecfService } from './ecf.service';
import { anulacionService, clasificarAnulacion, parsearRespuestaAnulacion } from './anulacion';
import { limpiarToken } from '../dgii/client';
import { validateAnecf, formatIssues } from '../xml/xsd-validator';
import { EcfAnulacion } from '../entities/ecf-anulacion.entity';

const RNC = '131880738';
const SEMILLA = '<?xml version="1.0" encoding="utf-8"?><SemillaModel><valor>abc123</valor><fecha>2026-10-21T10:00:00</fecha></SemillaModel>';

/** Simula los servicios de la DGII: semilla → token → anulación. */
function dgii(respuestaAnulacion: () => Response) {
  const llamadas: string[] = [];
  const fetchMock = vi.fn(async (url: string | URL) => {
    const u = String(url);
    llamadas.push(u);
    if (u.endsWith('/autenticacion/semilla')) return new Response(SEMILLA, { status: 200 });
    if (u.endsWith('/validarsemilla')) return Response.json({ token: 'jwt-prueba', expira: '2099-01-01T00:00:00Z' });
    if (u.endsWith('/anulacionrangos/api/operaciones/anularrango')) return respuestaAnulacion();
    return new Response('no encontrado', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return llamadas;
}

describe('Anulación de e-NCF no utilizados (ANECF)', () => {
  const fiscal = new FiscalService();
  const sales = new SalesService();

  beforeAll(async () => { await initTestDb(); });
  afterAll(async () => { await closeTestDb(); });
  beforeEach(async () => {
    await resetTestDb();
    limpiarToken();
    const repo = AppDataSource.getRepository(Setting);
    await repo.save(repo.create({
      id: 1, business_name: 'COLMADO PRUEBA SRL', business_address: 'Calle 1', business_tax_id: RNC,
      paper_size: '80mm', fiscal_enabled: true, itbis_rate: 18,
    }));
    await fiscal.saveSequence({ type: '32', from_number: 1, to_number: 100 });
    await ecfService.guardarConfig({ cert_path: escribirP12(RNC, 'clave'), cert_password: 'clave' });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  async function vender() {
    const user = await createTestUser();
    const shift = await createTestShift(user.id);
    const p = await createTestProduct({ sale_price: 100, stock: 10 });
    return sales.processSale(
      { user_id: user.id, shift_id: shift.id, payment_method: 'cash', amount_paid: 100, fiscal: { ncfType: '32' } },
      [{ product_id: p.id, quantity: 1 }],
    );
  }

  it('solo admite números no usados y dentro de una secuencia registrada', async () => {
    const r = await vender(); // usa E320000000001
    expect(r.ncf).toBe('E320000000001');
    await expect(anulacionService.validarRangoLocal('32', 1, 3)).rejects.toThrow(/ya se asignó/);
    await expect(anulacionService.validarRangoLocal('32', 90, 120)).rejects.toThrow(/no está dentro/);
    await expect(anulacionService.validarRangoLocal('31', 2, 3)).rejects.toThrow(/no está dentro/);
    await expect(anulacionService.validarRangoLocal('32', 2, 3)).resolves.toBeTruthy();
  });

  it('firma, envía y queda aceptada; la numeración salta el rango anulado', async () => {
    const llamadas = dgii(() => Response.json({
      rnc: RNC, codigo: '1', nombre: 'Anulación', mensajes: ['Las secuencias fueron anuladas correctamente.'],
    }));

    const a = await anulacionService.anular({ tipo: '32', desde: 1, hasta: 5 }, 'admin');
    expect(a).toMatchObject({ estado: 'aceptada', desde: 'E320000000001', hasta: 'E320000000005', cantidad: 5 });
    expect(llamadas.at(-1)).toBe('https://ecf.dgii.gov.do/testecf/anulacionrangos/api/operaciones/anularrango');

    const fila = await AppDataSource.getRepository(EcfAnulacion).findOneByOrFail({ id: a.id });
    const check = validateAnecf(fila.signed_xml!, { requireSignature: true });
    expect(check.valid, formatIssues(check)).toBe(true);

    const r = await vender();
    expect(r.ncf).toBe('E320000000006');
    await expect(anulacionService.validarRangoLocal('32', 7, 9)).resolves.toBeTruthy();
    await expect(anulacionService.validarRangoLocal('32', 4, 9)).rejects.toThrow(/ya se asignó/);
  });

  it('sin red queda pendiente (rango bloqueado) y se puede reenviar', async () => {
    dgii(() => { throw new TypeError('fetch failed'); });
    const a = await anulacionService.anular({ tipo: '32', desde: 1, hasta: 2 });
    expect(a.estado).toBe('pendiente');
    expect(a.last_error).toMatch(/fetch failed/);
    expect((await vender()).ncf).toBe('E320000000003');

    dgii(() => Response.json({ mensajes: ['Las secuencias fueron anuladas correctamente.'] }));
    expect((await anulacionService.enviar(a.id)).estado).toBe('aceptada');
  });

  it('si la DGII la rechaza, el rango vuelve a estar disponible', async () => {
    dgii(() => Response.json({ mensajes: ['Las secuencias que está intentando anular han sido utilizadas'] }, { status: 400 }));
    const a = await anulacionService.anular({ tipo: '32', desde: 1, hasta: 2 });
    expect(a.estado).toBe('rechazada');
    expect(a.dgii_mensajes).toMatch(/han sido utilizadas/);
    expect((await vender()).ncf).toBe('E320000000001');
  });

  it('interpreta la respuesta JSON o XML y el caso parcial', () => {
    expect(clasificarAnulacion({ mensajes: ['Las secuencias fueron anuladas correctamente. Con excepción de las secuencias del detalle'] })).toBe('parcial');
    expect(clasificarAnulacion({ mensajes: ['No fue posible anular las siguientes secuencias'] })).toBe('rechazada');
    const xml = parsearRespuestaAnulacion('<RespuestaAnulacionRango><rnc>1</rnc><codigo>2</codigo><nombre>x</nombre><mensajes>Las secuencias fueron anuladas correctamente.</mensajes></RespuestaAnulacionRango>');
    expect(xml.codigo).toBe('2');
    expect(clasificarAnulacion(xml)).toBe('aceptada');
  });
});
