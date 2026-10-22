import { describe, it, expect } from 'vitest';
import { mapearVenta, type VentaEcf } from '../xml/from-sale';
import { buildEcfXml } from '../xml/build-ecf';
import { validateRfce, formatIssues } from '../xml/xsd-validator';
import { construirRfce } from './emision';
import type { EcfDocument } from '../entities/ecf-document.entity';

/** Factura de Consumo por debajo del tope: `via = 'rfce'`. */
const VENTA: VentaEcf = {
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
    compradorRnc: '131880738',
    compradorNombre: 'Cliente Demo',
    lineas: [{ nombre: 'Café', cantidad: 2, precioUnitario: 118, montoLinea: 236, exento: false }],
    descuentoGlobal: 0,
    tasaItbis: 18,
    metodoPago: 'cash',
};

/** e-CF firmado de mentira: el RFCE solo lee su `<Encabezado>`. */
function ecfFirmado(): { xml: string; mapeo: ReturnType<typeof mapearVenta> } {
    const mapeo = mapearVenta(VENTA);
    const { xml } = buildEcfXml({
        tipo: VENTA.tipo,
        encf: VENTA.encf,
        fechaHoraFirma: VENTA.fechaHoraFirma,
        encabezado: mapeo.encabezado,
        detallesItems: mapeo.detallesItems,
        seccionesRaiz: mapeo.seccionesRaiz,
    });
    return { xml, mapeo };
}

function documento(sobrescribir: Partial<EcfDocument> = {}): EcfDocument {
    const { xml } = ecfFirmado();
    return {
        encf: VENTA.encf,
        codigo_seguridad: 'dcp79q',
        signed_xml: xml,
        ...sobrescribir,
    } as unknown as EcfDocument;
}

describe('construirRfce — RFCE derivado del e-CF firmado', () => {
    it('produce un resumen que valida contra rfce-32.xsd', () => {
        const rfce = construirRfce(documento());
        const check = validateRfce(rfce, { requireSignature: false });
        expect(check.valid, formatIssues(check)).toBe(true);
    });

    it('arrastra los datos del comprobante firmado, no de la venta', () => {
        const rfce = construirRfce(documento());
        expect(rfce).toContain('<eNCF>E320000000001</eNCF>');
        expect(rfce).toContain('<TipoeCF>32</TipoeCF>');
        expect(rfce).toContain('<RNCEmisor>101672919</RNCEmisor>');
        expect(rfce).toContain('<RazonSocialEmisor>VENILU SOFTWARE SRL</RazonSocialEmisor>');
        expect(rfce).toContain('<FechaEmision>26-09-2026</FechaEmision>');
        expect(rfce).toContain('<RazonSocialComprador>Cliente Demo</RazonSocialComprador>');
        expect(rfce).toContain('<CodigoSeguridadeCF>dcp79q</CodigoSeguridadeCF>');
        expect(rfce).toContain('<MontoTotal>');
    });

    it('lleva TipoIngresos, TipoPago y TablaFormasPago, y deja fuera lo que el RFCE no define', () => {
        const rfce = construirRfce(documento());
        expect(rfce).toContain('<TipoIngresos>01</TipoIngresos>');
        expect(rfce).toContain('<TipoPago>1</TipoPago>');
        expect(rfce).toContain('<TablaFormasPago>');
        // El RFCE es un resumen: sin detalle de ítems ni dirección del emisor.
        expect(rfce).not.toContain('DetallesItems');
        expect(rfce).not.toContain('DireccionEmisor');
        expect(rfce).not.toContain('FechaHoraFirma');
    });

    it('falla con un mensaje claro si falta el XML firmado o el código', () => {
        expect(() => construirRfce(documento({ signed_xml: undefined }))).toThrow(/no tiene e-CF firmado/);
        expect(() => construirRfce(documento({ codigo_seguridad: undefined }))).toThrow(/código de seguridad/);
    });
});
