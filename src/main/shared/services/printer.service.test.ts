import { describe, it, expect } from 'vitest';
import fs from 'fs';
import QRCode from 'qrcode';
import { PrinterService } from './printer.service';
import { mapearVenta, type VentaEcf } from '@main/modules/ecf/xml/from-sale';
import { buildEcfXml } from '@main/modules/ecf/xml/build-ecf';
import {
    datosRepresentacionImpresa,
    LEYENDA_CONTINGENCIA,
} from '@main/modules/ecf/ri/representacion-impresa';

const VENTA: VentaEcf = {
    tipo: 31,
    encf: 'E310000000045',
    fechaEmision: '21-10-2026',
    fechaHoraFirma: '21-10-2026 14:05:09',
    vencimientoSecuencia: '31-12-2027',
    emisor: {
        rnc: '101672919',
        razonSocial: 'COLMADO TONY SRL',
        nombreComercial: 'Tony Ranch',
        direccion: 'Calle Primera #12',
        municipio: '010100',
        provincia: '010000',
        telefono: '8095551234',
    },
    compradorRnc: '131880738',
    compradorNombre: 'Ferretería Ejemplo SRL',
    lineas: [
        { nombre: 'Café Santo Domingo 1 lb', cantidad: 2, precioUnitario: 295, montoLinea: 590, exento: false },
        { nombre: 'Huevos (cartón)', cantidad: 1, precioUnitario: 260, montoLinea: 260, exento: true },
    ],
    descuentoGlobal: 50,
    tasaItbis: 18,
    metodoPago: 'cash',
};

async function riHtml(contingencia: boolean) {
    const mapeo = mapearVenta(VENTA);
    const { xml } = buildEcfXml({
        tipo: VENTA.tipo,
        encf: VENTA.encf,
        fechaHoraFirma: VENTA.fechaHoraFirma,
        encabezado: mapeo.encabezado,
        detallesItems: mapeo.detallesItems,
        seccionesRaiz: mapeo.seccionesRaiz,
    });
    const ri = datosRepresentacionImpresa(xml, 'a1B2c3', 'ecf');
    const qr = await QRCode.toString(ri.urlQr, { type: 'svg', margin: 0 });
    return new PrinterService().generateReceiptHTML(
        {
            saleId: 'A1B2C3',
            saleDate: new Date('2026-10-21T14:05:00'),
            items: [],
            paymentMethod: 'cash',
            amountPaid: 1000,
            changeGiven: 200,
            userName: 'admin',
            ri,
            qr,
            contingencia,
        },
        { business_name: 'Ignorado con e-CF', paper_size: '80mm', currency: 'DOP', business_phone: '809-555-1234' }
    );
}

describe('PrinterService — Representación Impresa del e-CF', () => {
    it('incluye los datos obligatorios de la RI (Informe Técnico §18)', async () => {
        const html = await riHtml(false);
        // Encabezado: tipo en palabras, e-NCF, vencimiento, emisor.
        expect(html).toContain('Factura de Crédito Fiscal Electrónica');
        expect(html).toContain('E310000000045');
        expect(html).toContain('Fecha Vencimiento: 31-12-2027');
        expect(html).toContain('Tony Ranch');
        expect(html).toContain('COLMADO TONY SRL');
        expect(html).toContain('RNC: 101672919');
        expect(html).toContain('SANTO DOMINGO DE GUZMÁN, DISTRITO NACIONAL');
        expect(html).toContain('Fecha Emisión: 21-10-2026');
        // Comprador.
        expect(html).toContain('Ferretería Ejemplo SRL');
        expect(html).toContain('131880738');
        // Exento marcado con "E".
        expect(html).toMatch(/<b>E<\/b> Huevos/);
        // Totales y datos de consulta.
        expect(html).toContain('Subtotal Gravado');
        expect(html).toContain('Subtotal Exento');
        expect(html).toContain('Total ITBIS');
        expect(html).toContain('<svg');
        expect(html).toContain('Código de Seguridad: <b>a1B2c3</b>');
        expect(html).toContain('Fecha de Firma Digital: 21-10-2026 14:05:09');
        expect(html).not.toContain('Ignorado con e-CF');
        expect(html).not.toContain(LEYENDA_CONTINGENCIA);

        if (process.env.VENILU_DUMP_RI) fs.writeFileSync(process.env.VENILU_DUMP_RI, html);
    });

    it('agrega la leyenda de contingencia cuando el e-CF no se transmitió', async () => {
        const html = await riHtml(true);
        expect(html).toContain(LEYENDA_CONTINGENCIA);
        if (process.env.VENILU_DUMP_RI) {
            fs.writeFileSync(process.env.VENILU_DUMP_RI.replace(/\.html$/, '-contingencia.html'), html);
        }
    });
});
