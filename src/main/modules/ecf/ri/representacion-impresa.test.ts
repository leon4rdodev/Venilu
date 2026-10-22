import { describe, it, expect } from 'vitest';
import { mapearVenta, type VentaEcf } from '../xml/from-sale';
import { buildEcfXml } from '../xml/build-ecf';
import { datosRepresentacionImpresa, LEYENDA_CONTINGENCIA } from './representacion-impresa';

function venta(sobrescribir: Partial<VentaEcf> = {}): VentaEcf {
    return {
        tipo: 32,
        encf: 'E320000000007',
        fechaEmision: '21-10-2026',
        fechaHoraFirma: '21-10-2026 14:05:09',
        emisor: {
            rnc: '101672919',
            razonSocial: 'COLMADO TONY SRL',
            nombreComercial: 'Tony Ranch',
            direccion: 'Calle 1 #2',
            municipio: '010100',
            provincia: '010000',
            telefono: '8095551234',
        },
        lineas: [
            { nombre: 'Café', cantidad: 2, precioUnitario: 118, montoLinea: 236, exento: false },
            { nombre: 'Huevos', cantidad: 1.5, precioUnitario: 10, montoLinea: 15, exento: true },
        ],
        descuentoGlobal: 0,
        tasaItbis: 18,
        metodoPago: 'cash',
        ...sobrescribir,
    };
}

function xml(v: VentaEcf): string {
    const mapeo = mapearVenta(v);
    return buildEcfXml({
        tipo: v.tipo,
        encf: v.encf,
        fechaHoraFirma: v.fechaHoraFirma,
        encabezado: mapeo.encabezado,
        detallesItems: mapeo.detallesItems,
        seccionesRaiz: mapeo.seccionesRaiz,
    }).xml;
}

describe('datosRepresentacionImpresa — Informe Técnico §18', () => {
    it('lee del XML firmado los datos del encabezado del emisor (§18.2.1-B)', () => {
        const ri = datosRepresentacionImpresa(xml(venta()), 'dcp79q', 'ecf');
        expect(ri.tipoNombre).toBe('Factura de Consumo Electrónica');
        expect(ri.encf).toBe('E320000000007');
        expect(ri.emisor).toMatchObject({
            rnc: '101672919',
            razonSocial: 'COLMADO TONY SRL',
            nombreComercial: 'Tony Ranch',
            municipio: 'SANTO DOMINGO DE GUZMÁN',
            provincia: 'DISTRITO NACIONAL',
            telefono: '809-555-1234',
        });
        expect(ri.fechaEmision).toBe('21-10-2026');
        // La fecha de vencimiento no aplica a la factura de consumo (nota 43).
        expect(ri.fechaVencimiento).toBeNull();
    });

    it('marca la línea exenta con "E" y conserva los valores (§18.2.2)', () => {
        const ri = datosRepresentacionImpresa(xml(venta()), 'dcp79q', 'ecf');
        expect(ri.lineas).toEqual([
            expect.objectContaining({ cantidad: '2', exento: false, descripcion: 'Café', valor: '236.00' }),
            expect.objectContaining({ cantidad: '1.5', exento: true, descripcion: 'Huevos', valor: '15.00' }),
        ]);
        expect(ri.totales.exento).toBe('15.00');
        expect(ri.totales.total).toBe('251.00');
    });

    it('usa el timbre de consumo para un 32 menor a RD$250,000 (§18.2.3)', () => {
        const ri = datosRepresentacionImpresa(xml(venta()), 'dcp79q', 'ecf');
        expect(ri.urlQr).toBe(
            'https://fc.dgii.gov.do/ecf/consultatimbrefc?rncemisor=101672919&encf=E320000000007&montototal=251.00&codigoseguridad=dcp79q'
        );
        expect(ri.fechaFirma).toBe('21-10-2026 14:05:09');
        expect(ri.codigoSeguridad).toBe('dcp79q');
    });

    it('en una 31 muestra la fecha de vencimiento y usa el timbre general', () => {
        const ri = datosRepresentacionImpresa(
            xml(
                venta({
                    tipo: 31,
                    encf: 'E310000000003',
                    vencimientoSecuencia: '31-12-2027',
                    compradorRnc: '131880738',
                    compradorNombre: 'Empresa SRL',
                })
            ),
            'abc123',
            'testecf'
        );
        expect(ri.fechaVencimiento).toBe('31-12-2027');
        expect(ri.comprador).toEqual({ rnc: '131880738', nombre: 'Empresa SRL' });
        expect(ri.urlQr).toBe(
            'https://ecf.dgii.gov.do/testecf/consultatimbre?rncemisor=101672919&rnccomprador=131880738' +
                '&encf=E310000000003&fechaemision=21-10-2026&montototal=251.00' +
                '&fechafirma=21-10-2026%2014:05:09&codigoseguridad=abc123'
        );
    });

    it('en una Nota de Crédito muestra el e-NCF modificado y el código en palabras', () => {
        const ri = datosRepresentacionImpresa(
            xml(
                venta({
                    tipo: 34,
                    encf: 'E340000000002',
                    referencia: {
                        encfModificado: 'E320000000007',
                        fechaModificado: '20-10-2026',
                        codigoModificacion: 3,
                    },
                })
            ),
            'zz9911',
            'ecf'
        );
        expect(ri.tipoNombre).toBe('Nota de Crédito Electrónica');
        expect(ri.ncfModificado).toBe('E320000000007');
        expect(ri.codigoModificacionNombre).toBe('Corrige montos del NCF modificado');
        expect(ri.fechaVencimiento).toBeNull();
    });

    it('la leyenda de contingencia conserva el texto oficial', () => {
        expect(LEYENDA_CONTINGENCIA).toMatch(/^e-CF emitido en modalidad de Contingencia/);
        expect(LEYENDA_CONTINGENCIA).toMatch(/setenta y dos \(72\) horas$/);
    });
});
