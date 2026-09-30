import { describe, it, expect } from 'vitest';
import { mapearVenta, type VentaEcf } from './from-sale';
import { buildEcfXml } from './build-ecf';
import { validateEcf, formatIssues } from './xsd-validator';

/** Venta mínima reutilizable; cada test cambia lo que necesita. */
function venta(sobrescribir: Partial<VentaEcf> = {}): VentaEcf {
    return {
        tipo: 32,
        encf: 'E320000000001',
        fechaEmision: '26-09-2026',
        fechaHoraFirma: '26-09-2026 10:00:00',
        emisor: {
            rnc: '101672919',
            razonSocial: 'VENILU SOFTWARE SRL',
            direccion: 'Av. Tiradentes 123',
            telefono: '8095551234',
        },
        compradorNombre: 'Consumidor Final',
        lineas: [
            { nombre: 'Café', cantidad: 2, precioUnitario: 118, montoLinea: 236, exento: false },
        ],
        descuentoGlobal: 0,
        tasaItbis: 18,
        metodoPago: 'cash',
        ...sobrescribir,
    };
}

/** Construye el XML de la venta y lo valida contra el XSD oficial de la DGII. */
function xmlDe(v: VentaEcf): string {
    const mapeo = mapearVenta(v);
    const { xml } = buildEcfXml({
        tipo: v.tipo,
        encf: v.encf,
        fechaHoraFirma: v.fechaHoraFirma,
        encabezado: mapeo.encabezado,
        detallesItems: mapeo.detallesItems,
        seccionesRaiz: mapeo.seccionesRaiz,
    });
    const check = validateEcf(xml, v.tipo, { requireSignature: false });
    expect(check.valid, formatIssues(check)).toBe(true);
    return xml;
}

describe('mapearVenta — TablaTelefonoEmisor', () => {
    it('omite el tag cuando el teléfono está vacío y el XML sigue validando', () => {
        const mapeo = mapearVenta(venta({ emisor: { ...venta().emisor, telefono: '' } }));
        expect(mapeo.encabezado.Emisor).not.toHaveProperty('TablaTelefonoEmisor');
        expect(xmlDe(venta({ emisor: { ...venta().emisor, telefono: '' } }))).not.toContain(
            'TablaTelefonoEmisor'
        );
    });

    it('omite el tag cuando el teléfono no admite el formato del XSD', () => {
        for (const telefono of ['809555123', '80955512345', '809 555 12', '']) {
            const mapeo = mapearVenta(venta({ emisor: { ...venta().emisor, telefono } }));
            expect(mapeo.encabezado.Emisor, `teléfono "${telefono}"`).not.toHaveProperty(
                'TablaTelefonoEmisor'
            );
        }
    });

    it('normaliza a xxx-xxx-xxxx cuando son 10 dígitos', () => {
        for (const telefono of ['8095551234', '809-555-1234', '(809) 555.1234']) {
            const mapeo = mapearVenta(venta({ emisor: { ...venta().emisor, telefono } }));
            expect(mapeo.encabezado.Emisor, `teléfono "${telefono}"`).toEqual(
                expect.objectContaining({
                    TablaTelefonoEmisor: { TelefonoEmisor: '809-555-1234' },
                })
            );
        }
    });
});

describe('mapearVenta — vía de transmisión', () => {
    it('una Factura de Consumo menor a RD$250,000 va por RFCE', () => {
        expect(mapearVenta(venta()).via).toBe('rfce');
    });

    it('una Factura de Consumo de RD$250,000 o más va por recepción de e-CF', () => {
        const v = venta({ lineas: [{ nombre: 'Equipo', cantidad: 1, precioUnitario: 295_000, montoLinea: 295_000, exento: false }] });
        expect(mapearVenta(v).via).toBe('ecf');
    });

    it('el Crédito Fiscal (31) y la Nota de Crédito (34) van por recepción de e-CF', () => {
        expect(mapearVenta(venta({ tipo: 31 })).via).toBe('ecf');
        expect(
            mapearVenta(
                venta({
                    tipo: 34,
                    referencia: { encfModificado: 'E320000000001', fechaModificado: '25-09-2026', codigoModificacion: 1 },
                })
            ).via
        ).toBe('ecf');
    });
});

describe('mapearVenta — Nota de Crédito (34)', () => {
    it('exige InformacionReferencia', () => {
        expect(() => mapearVenta(venta({ tipo: 34 }))).toThrow(/InformacionReferencia/);
    });

    it('incluye NCFModificado, FechaNCFModificado y CodigoModificacion', () => {
        const mapeo = mapearVenta(
            venta({
                tipo: 34,
                referencia: { encfModificado: 'E320000000001', fechaModificado: '25-09-2026', codigoModificacion: 1 },
            })
        );
        expect(mapeo.seccionesRaiz.InformacionReferencia).toEqual({
            NCFModificado: 'E320000000001',
            FechaNCFModificado: '25-09-2026',
            CodigoModificacion: 1,
        });
    });
});
