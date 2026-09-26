import { describe, it, expect } from 'vitest';
import { buildEcfXml, type BuildEcfInput } from './build-ecf';
import { validateEcf, formatIssues } from './xsd-validator';
import { getParsedSchema, verifySchemaIntegrity } from './xsd-model';
import { SCHEMAS } from '../schemas';

/** Valida el XML tal cual sale del builder (aún sin firmar). */
const check = (xml: string, tipo: 31 | 32 | 34) =>
    validateEcf(xml, tipo, { requireSignature: false });

/** Ejemplo completo de Factura de Crédito Fiscal Electrónica (E31). */
function e31(): BuildEcfInput {
    return {
        tipo: 31,
        encf: 'E310000000001',
        fechaHoraFirma: '26-09-2026 10:30:00',
        encabezado: {
            IdDoc: {
                FechaVencimientoSecuencia: '31-10-2026',
                IndicadorMontoGravado: 1,
                TipoIngresos: '01',
                TipoPago: 1,
                TablaFormasPago: {
                    FormaDePago: [{ FormaPago: 1, MontoPago: 200 }],
                },
            },
            Emisor: {
                RNCEmisor: '131880738',
                RazonSocialEmisor: 'VENILU SOFTWARE SRL',
                NombreComercial: 'Venilu',
                DireccionEmisor: 'CALLE PRINCIPAL #123',
                Municipio: '010100',
                Provincia: '010100',
                TablaTelefonoEmisor: { TelefonoEmisor: ['809-555-5555'] },
                CorreoEmisor: 'ventas@venilu.do',
                ActividadEconomica: '47590 - Comercio al por menor',
                FechaEmision: '26-09-2026',
            },
            Comprador: {
                RNCComprador: '131880739',
                RazonSocialComprador: 'CLIENTE EJEMPLO SRL',
                DireccionComprador: 'AVENIDA REPUBLICA 45',
                MunicipioComprador: '010100',
                ProvinciaComprador: '010100',
            },
            Totales: {
                MontoGravadoTotal: 84.75,
                MontoGravadoI1: 84.75,
                MontoExento: 100,
                ITBIS1: 18,
                TotalITBIS: 15.25,
                TotalITBIS1: 15.25,
                MontoTotal: 200,
            },
        },
        detallesItems: {
            Item: [
                {
                    NumeroLinea: 1,
                    IndicadorFacturacion: 1,
                    NombreItem: 'PRODUCTO GRAVADO',
                    IndicadorBienoServicio: 1,
                    DescripcionItem: 'Artículo de prueba & demostración',
                    CantidadItem: 1,
                    UnidadMedida: 6,
                    PrecioUnitarioItem: 100,
                    MontoItem: 100,
                },
                {
                    NumeroLinea: 2,
                    IndicadorFacturacion: 4,
                    NombreItem: 'PRODUCTO EXENTO',
                    IndicadorBienoServicio: 1,
                    CantidadItem: 1,
                    UnidadMedida: 6,
                    PrecioUnitarioItem: 100,
                    MontoItem: 100,
                },
            ],
        },
    };
}

describe('e-CF — procedencia de los XSD oficiales', () => {
    it('cada XSD incrustado sigue siendo el archivo descargado de la DGII', () => {
        // Si alguien regenera o edita los XSD sin pasar por scripts/gen-xsd.mjs,
        // o altera los hash, esta prueba lo delata.
        expect(SCHEMAS['ecf-31'].sha256).toBe(
            '6f2909a93d84919518d2ae3c77fead4b35c3e8c95996b8af67b0040c2e2be298'
        );
        expect(verifySchemaIntegrity('ecf-31', SCHEMAS['ecf-31'].sha256)).toBe(true);
        expect(verifySchemaIntegrity('ecf-31', 'deadbeef')).toBe(false);
    });

    it('compila el árbol completo del XSD oficial', () => {
        const root = getParsedSchema('ecf-31').root;
        expect(root.name).toBe('ECF');
        const names = root.children!.map((c) => c.name);
        expect(names).toEqual([
            'Encabezado', 'DetallesItems', 'Subtotales', 'DescuentosORecargos',
            'Paginacion', 'InformacionReferencia', 'FechaHoraFirma', '*',
        ]);
        // El último nodo es el slot de la firma y es obligatorio (minOccurs=1).
        const firma = root.children![root.children!.length - 1];
        expect(firma.any).toBe(true);
        expect(firma.minOccurs).toBe(1);
        expect(firma.maxOccurs).toBe(1);
    });
});

describe('e-CF — construcción del XML', () => {
    it('genera un E31 válido contra el XSD oficial', () => {
        const { xml, descartados } = buildEcfXml(e31());
        const result = check(xml, 31);
        expect(result.issues, formatIssues(result)).toHaveLength(0);
        expect(descartados).toEqual([]);
        expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?><ECF>')).toBe(true);
    });

    it('el orden de los tags sigue exactamente el XSD (aunque el input venga desordenado)', () => {
        const input = e31();
        // Orden invertido a propósito: el builder debe reordenar por el esquema.
        input.encabezado = {
            Totales: input.encabezado.Totales,
            Comprador: input.encabezado.Comprador,
            Emisor: input.encabezado.Emisor,
            IdDoc: input.encabezado.IdDoc,
        };
        const { xml } = buildEcfXml(input);
        expect(check(xml, 31).valid).toBe(true);

        const encabezado = xml.slice(xml.indexOf('<Encabezado>'), xml.indexOf('</Encabezado>'));
        const orden = ['<Version>', '<IdDoc>', '<Emisor>', '<Comprador>', '<Totales>'];
        let cursor = -1;
        for (const tag of orden) {
            const at = encabezado.indexOf(tag);
            expect(at, `falta o está desordenado ${tag}`).toBeGreaterThan(cursor);
            cursor = at;
        }
    });

    it('no emite tags vacíos', () => {
        const input = e31();
        const comprador = input.encabezado.Comprador as Record<string, unknown>;
        comprador.CorreoComprador = '   ';
        comprador.ContactoComprador = '';
        const { xml } = buildEcfXml(input);
        expect(xml).not.toContain('<CorreoComprador>');
        expect(xml).not.toContain('<ContactoComprador>');
        expect(check(xml, 31).valid).toBe(true);
    });

    it('conserva el cero explícito (no es un tag vacío)', () => {
        const input = e31();
        (input.encabezado.IdDoc as Record<string, unknown>).IndicadorMontoGravado = 0;
        const { xml } = buildEcfXml(input);
        expect(xml).toContain('<IndicadorMontoGravado>0</IndicadorMontoGravado>');
        expect(check(xml, 31).valid).toBe(true);
    });

    it('escapa los cinco caracteres reservados que exige la DGII', () => {
        const input = e31();
        const emisor = input.encabezado.Emisor as Record<string, unknown>;
        emisor.RazonSocialEmisor = 'A & B <"C"> \'D\'';
        const { xml } = buildEcfXml(input);
        expect(xml).toContain('<RazonSocialEmisor>A &amp; B &lt;&quot;C&quot;&gt; &apos;D&apos;</RazonSocialEmisor>');
        expect(check(xml, 31).valid).toBe(true);
    });

    it('descarta tags que no existen en el XSD del tipo pedido', () => {
        const input = e31();
        // FechaVencimientoSecuencia SOLO existe en el XSD 31.
        const { xml, descartados } = buildEcfXml({
            ...input,
            tipo: 32,
            encf: 'E320000000001',
            encabezado: {
                ...input.encabezado,
                IdDoc: {
                    TipoIngresos: '01',
                    TipoPago: 1,
                    FechaVencimientoSecuencia: '31-10-2026',
                },
                Comprador: { RazonSocialComprador: 'CONSUMIDOR FINAL' },
            },
        });
        expect(descartados).toContain('/ECF/Encabezado/IdDoc/FechaVencimientoSecuencia');
        expect(xml).not.toContain('FechaVencimientoSecuencia');
        expect(check(xml, 32).valid).toBe(true);
    });
});

describe('e-CF — el validador detecta lo que la DGII rechazaría', () => {
    it('falta un tag obligatorio', () => {
        const input = e31();
        delete (input.encabezado.Emisor as Record<string, unknown>).FechaEmision;
        const { xml } = buildEcfXml(input);
        const result = check(xml, 31);
        expect(result.valid).toBe(false);
        expect(formatIssues(result)).toContain('<FechaEmision>');
    });

    it('falta la firma digital (único hijo obligatorio después de FechaHoraFirma)', () => {
        const { xml } = buildEcfXml(e31());
        // Por omisión se valida como se envía a la DGII: firmado.
        const result = validateEcf(xml, 31);
        expect(result.valid).toBe(false);
        expect(formatIssues(result)).toContain('firma digital');
        // Y antes de firmar el builder sí se da por bueno (requireSignature: false).
        expect(check(xml, 31).valid).toBe(true);
    });

    it('un valor fuera del catálogo de la DGII', () => {
        const input = e31();
        (input.encabezado.IdDoc as Record<string, unknown>).TipoPago = 9;
        const { xml } = buildEcfXml(input);
        const result = check(xml, 31);
        expect(result.valid).toBe(false);
        expect(formatIssues(result)).toContain('catálogo');
    });

    it('un e-NCF que no mida 13 caracteres', () => {
        const { xml } = buildEcfXml({ ...e31(), encf: 'B0100000143' });
        const result = check(xml, 31);
        expect(result.valid).toBe(false);
        expect(formatIssues(result)).toMatch(/patrón/);
    });

    it('una fecha con formato distinto a dd-MM-yyyy', () => {
        const input = e31();
        (input.encabezado.Emisor as Record<string, unknown>).FechaEmision = '2026-09-26';
        const { xml } = buildEcfXml(input);
        expect(check(xml, 31).valid).toBe(false);
    });

    it('redondea al máximo de decimales que admite el propio XSD', () => {
        // La DGII exige aplicar "la regla de redondeos" en los campos
        // numéricos; el XSD de MontoTotal admite 2 decimales.
        const input = e31();
        (input.encabezado.Totales as Record<string, unknown>).MontoTotal = 200.125;
        const { xml } = buildEcfXml(input);
        expect(xml).toContain('<MontoTotal>200.13</MontoTotal>');
        expect(check(xml, 31).valid).toBe(true);
    });

    it('detecta un decimal con más decimales de los que admite el XSD', () => {
        // Si el valor llega como texto ya formateado, el builder no lo toca y
        // el validador es quien lo rechaza.
        const input = e31();
        (input.encabezado.Totales as Record<string, unknown>).MontoTotal = '200.123';
        const { xml } = buildEcfXml(input);
        const result = check(xml, 31);
        expect(result.valid).toBe(false);
        expect(formatIssues(result)).toMatch(/fractionDigits|patrón/);
    });

    it('un tag fuera de orden', () => {
        const input = e31();
        const { xml } = buildEcfXml(input);
        // Fuerza el desorden a mano, como haría un retoque posterior al builder.
        const desordenado = xml.replace(
            /<Emisor>.*?<\/Emisor>/s,
            (emisor) => emisor.replace('<RNCEmisor>131880738</RNCEmisor>', '')
        ).replace(
            /(<Comprador>.*?<\/Comprador>)(<Totales>)/s,
            '$2$1'
        );
        const result = check(desordenado, 31);
        expect(result.valid).toBe(false);
        expect(formatIssues(result)).toMatch(/orden/);
    });
});

describe('e-CF — tipos 32 y 34', () => {
    it('E32 (Factura de Consumo) valida con Comprador sin RNC', () => {
        const { xml } = buildEcfXml({
            tipo: 32,
            encf: 'E320000000001',
            fechaHoraFirma: '26-09-2026 10:30:00',
            encabezado: {
                IdDoc: { IndicadorMontoGravado: 1, TipoIngresos: '01', TipoPago: 1 },
                Emisor: {
                    RNCEmisor: '131880738',
                    RazonSocialEmisor: 'VENILU SOFTWARE SRL',
                    DireccionEmisor: 'CALLE PRINCIPAL #123',
                    FechaEmision: '26-09-2026',
                },
                Comprador: { RazonSocialComprador: 'CONSUMIDOR FINAL' },
                Totales: { MontoGravadoI1: 84.75, MontoGravadoTotal: 84.75, ITBIS1: 18, TotalITBIS: 15.25, TotalITBIS1: 15.25, MontoTotal: 100 },
            },
            detallesItems: {
                Item: [{
                    NumeroLinea: 1, IndicadorFacturacion: 1, NombreItem: 'PRODUCTO',
                    IndicadorBienoServicio: 1, CantidadItem: 1, PrecioUnitarioItem: 100, MontoItem: 100,
                }],
            },
        });
        const result = check(xml, 32);
        expect(result.issues, formatIssues(result)).toHaveLength(0);
    });

    it('E34 (Nota de Crédito) exige InformacionReferencia e IndicadorNotaCredito', () => {
        const base: BuildEcfInput = {
            tipo: 34,
            encf: 'E340000000001',
            fechaHoraFirma: '26-09-2026 10:30:00',
            encabezado: {
                IdDoc: { IndicadorNotaCredito: 0, TipoPago: 1 },
                Emisor: {
                    RNCEmisor: '131880738',
                    RazonSocialEmisor: 'VENILU SOFTWARE SRL',
                    DireccionEmisor: 'CALLE PRINCIPAL #123',
                    FechaEmision: '26-09-2026',
                },
                Comprador: {
                    RNCComprador: '131880739',
                    RazonSocialComprador: 'CLIENTE EJEMPLO SRL',
                },
                Totales: { MontoGravadoI1: 84.75, MontoGravadoTotal: 84.75, ITBIS1: 18, TotalITBIS: 15.25, TotalITBIS1: 15.25, MontoTotal: 100 },
            },
            detallesItems: {
                Item: [{
                    NumeroLinea: 1, IndicadorFacturacion: 1, NombreItem: 'PRODUCTO',
                    IndicadorBienoServicio: 1, CantidadItem: 1, PrecioUnitarioItem: 100, MontoItem: 100,
                }],
            },
        };

        const sinRef = buildEcfXml(base);
        const r1 = check(sinRef.xml, 34);
        expect(r1.valid).toBe(false);
        expect(formatIssues(r1)).toMatch(/InformacionReferencia|IndicadorNotaCredito/);

        const conRef = buildEcfXml({
            ...base,
            seccionesRaiz: {
                InformacionReferencia: {
                    NCFModificado: 'E310000000001',
                    RNCOtroContribuyente: '131880739',
                    FechaNCFModificado: '20-09-2026',
                    CodigoModificacion: 3,
                },
            },
        });
        const r2 = check(conRef.xml, 34);
        expect(r2.issues, formatIssues(r2)).toHaveLength(0);
    });
});
