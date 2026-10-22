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

/**
 * Casos que el POS produce a diario y que romperían la firma si el mapeo
 * cambiara: comprador sin datos, cantidad fraccionaria y totales que deben
 * cuadrar con `sales.total_amount` / `sales.itbis_amount`.
 */
describe('mapearVenta — Factura de Consumo en condiciones reales', () => {
    /** `fiscal_customer_rnc` y `fiscal_customer_name` vacíos. */
    const sinComprador = { compradorRnc: undefined, compradorNombre: undefined } as const;

    it('el XML valida con <Comprador> vacío (todos sus hijos son minOccurs=0)', () => {
        expect(xmlDe(venta(sinComprador))).toContain('<Comprador></Comprador>');
    });

    it('admite cantidades con decimal (cantidad 0.5)', () => {
        xmlDe(
            venta({
                ...sinComprador,
                lineas: [
                    { nombre: 'Azúcar', cantidad: 0.5, precioUnitario: 15, montoLinea: 7.5, exento: true },
                ],
            })
        );
    });

    it('cuadra con los totales de la venta (674.99 con 85.42 de ITBIS incluidos)', () => {
        const xml = xmlDe(
            venta({
                ...sinComprador,
                metodoPago: 'transfer',
                lineas: [
                    { nombre: 'Azucar Morena', cantidad: 5, precioUnitario: 15, montoLinea: 75, exento: true },
                    { nombre: 'Arroz Selecto 1lb', cantidad: 1, precioUnitario: 40, montoLinea: 40, exento: true },
                    { nombre: 'Cerveza Presidente', cantidad: 1, precioUnitario: 200, montoLinea: 200, exento: false },
                    { nombre: 'Jabón Líquido', cantidad: 1, precioUnitario: 149.99, montoLinea: 149.99, exento: false },
                    { nombre: 'Cerveza Presidente Pequeña', cantidad: 1, precioUnitario: 100, montoLinea: 100, exento: false },
                    { nombre: 'Pan De Agua', cantidad: 1, precioUnitario: 10, montoLinea: 10, exento: false },
                    { nombre: 'Refresco Cola 2L', cantidad: 1, precioUnitario: 100, montoLinea: 100, exento: false },
                ],
            })
        );
        expect(xml).toContain('<MontoTotal>674.99</MontoTotal>');
        expect(xml).toContain('<TotalITBIS>85.42</TotalITBIS>');
    });

    it('normaliza el teléfono de Ajustes (8095551234 → 809-555-1234)', () => {
        expect(xmlDe(venta(sinComprador))).toContain('<TelefonoEmisor>809-555-1234</TelefonoEmisor>');
    });

    it('vía RFCE cuando el total es menor a RD$250,000', () => {
        expect(mapearVenta(venta(sinComprador)).via).toBe('rfce');
    });
});

describe('mapearVenta — descuento por línea (Formato e-CF, campos 26–29 y 39)', () => {
    const conDescuento = () =>
        venta({
            lineas: [
                { nombre: 'Café', cantidad: 2, precioUnitario: 118, montoLinea: 236, exento: false },
                { nombre: 'Pan', cantidad: 1, precioUnitario: 64, montoLinea: 64, exento: true },
            ],
            descuentoGlobal: 30,
        });

    it('emite <DescuentoMonto> con su <TablaSubDescuento> y valida contra el XSD', () => {
        const xml = xmlDe(conDescuento());
        expect(xml).toContain('<DescuentoMonto>');
        expect(xml).toContain('<TipoSubDescuento>$</TipoSubDescuento>');
        expect(xml).not.toContain('MontoDescuentoItem');
    });

    it('MontoItem = Precio × Cantidad − DescuentoMonto en cada línea', () => {
        const items = mapearVenta(conDescuento()).detallesItems.Item as Array<Record<string, number>>;
        for (const it of items) {
            const esperado = Math.round((it.PrecioUnitarioItem * it.CantidadItem - (it.DescuentoMonto ?? 0)) * 100) / 100;
            expect(it.MontoItem).toBeCloseTo(esperado, 2);
        }
        const totalDescuento = items.reduce((s, it) => s + (it.DescuentoMonto ?? 0), 0);
        expect(totalDescuento).toBeCloseTo(30, 2);
    });
});

describe('mapearVenta — reemplazo de contingencia (código 4)', () => {
    const referencia = {
        encfModificado: 'B0200000123',
        fechaModificado: '01-10-2026',
        codigoModificacion: 4,
    };

    it('una factura 32 de reemplazo lleva InformacionReferencia y valida', () => {
        const xml = xmlDe(venta({ referencia }));
        expect(xml).toContain('<NCFModificado>B0200000123</NCFModificado>');
        expect(xml).toContain('<CodigoModificacion>4</CodigoModificacion>');
    });

    it('una factura 31 de reemplazo también valida contra su XSD', () => {
        const xml = xmlDe(
            venta({
                tipo: 31,
                encf: 'E310000000001',
                vencimientoSecuencia: '31-12-2027',
                compradorRnc: '131880738',
                compradorNombre: 'Empresa SRL',
                referencia: { ...referencia, encfModificado: 'B0100000045' },
            })
        );
        expect(xml).toContain('<NCFModificado>B0100000045</NCFModificado>');
    });

    it('rechaza otros códigos de modificación fuera de la Nota de Crédito', () => {
        expect(() => mapearVenta(venta({ referencia: { ...referencia, codigoModificacion: 1 } }))).toThrow(
            /reemplazo de contingencia/
        );
    });
});

describe('mapearVenta — el MontoTotal es lo cobrado', () => {
    it('no pierde centavos al separar el ITBIS incluido en el precio', () => {
        const v = venta({
            tipo: 31,
            encf: 'E310000000045',
            vencimientoSecuencia: '31-12-2027',
            compradorRnc: '131880738',
            lineas: [
                { nombre: 'Café', cantidad: 2, precioUnitario: 295, montoLinea: 590, exento: false },
                { nombre: 'Huevos', cantidad: 1, precioUnitario: 260, montoLinea: 260, exento: true },
            ],
            descuentoGlobal: 50,
        });
        const t = mapearVenta(v).totales as Record<string, number | string>;
        expect(t.MontoTotal).toBe('800.00');
        expect(Number(t.MontoGravadoTotal) + Number(t.MontoExento) + Number(t.TotalITBIS)).toBeCloseTo(800, 2);
        // ITBIS dentro de la tolerancia de cuadratura frente a base × tasa.
        expect(Math.abs(Number(t.TotalITBIS1) - Number(t.MontoGravadoI1) * 0.18)).toBeLessThanOrEqual(0.01);
        xmlDe(v);
    });
});
