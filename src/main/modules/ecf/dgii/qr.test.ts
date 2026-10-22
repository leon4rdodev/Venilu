import { describe, it, expect } from 'vitest';
import { codificarParametro, urlTimbreConsumo, urlTimbreEcf, urlTimbrePara, UMBRAL_CONSUMO } from './qr';

/**
 * Los dos tests siguientes reproducen LITERALMENTE los "Ejemplo URL construida"
 * publicados por la DGII en "Descripción Técnica Servicios DGII" (servicios
 * "Consulta timbre (QR)" y "Consulta timbre FC (QR)"). Si el generador de URLs
 * no produce exactamente esa cadena, algo del contrato se habría cambiado sin
 * documento que lo respalde. Ver `docs/fec/FUENTES.md`.
 */
describe('QR del timbre — ejemplos oficiales de la DGII', () => {
    it('consulta timbre general (servicio "Consulta Timbre")', () => {
        // Descripción Técnica Servicios DGII → Consulta timbre (QR) → Ejemplo URL construida:
        //   https://ecf.dgii.gov.do/testecf/consultatimbre?rncemisor=130000001
        //   &rnccomprador=130000002&encf=e310000000001&fechaemision=10-10-2020
        //   &montototal=02.11&fechafirma=10-10-2020%2009:00:00
        //   &codigoseguridad=dcp79q
        const url = urlTimbreEcf({
            ambiente: 'testecf',
            rncEmisor: '130000001',
            rncComprador: '130000002',
            encf: 'e310000000001',
            fechaEmision: '10-10-2020',
            montoTotal: '02.11',
            fechaFirma: '10-10-2020 09:00:00',
            codigoSeguridad: 'dcp79q',
        });
        expect(url).toBe(
            'https://ecf.dgii.gov.do/testecf/consultatimbre' +
                '?rncemisor=130000001' +
                '&rnccomprador=130000002' +
                '&encf=e310000000001' +
                '&fechaemision=10-10-2020' +
                '&montototal=02.11' +
                '&fechafirma=10-10-2020%2009:00:00' +
                '&codigoseguridad=dcp79q'
        );
    });

    it('consulta timbre de Factura de Consumo < RD$250,000 (servicio "Consulta Timbre FC")', () => {
        // Descripción Técnica Servicios DGII → Consulta timbre FC (QR) → Ejemplo URL construida:
        //   https://fc.dgii.gov.do/testecf/consultatimbrefc?rncemisor=131880738
        //   &encf=e320000000064&montototal=6225.09&codigoseguridad=uabnyh
        const url = urlTimbreConsumo({
            ambiente: 'testecf',
            rncEmisor: '131880738',
            encf: 'e320000000064',
            montoTotal: '6225.09',
            codigoSeguridad: 'uabnyh',
        });
        expect(url).toBe(
            'https://fc.dgii.gov.do/testecf/consultatimbrefc' +
                '?rncemisor=131880738' +
                '&encf=e320000000064' +
                '&montototal=6225.09' +
                '&codigoseguridad=uabnyh'
        );
    });
});

describe('QR del timbre — codificación de caracteres reservados', () => {
    it('codifica la tabla que la DGII exige para el código de seguridad', () => {
        // Descripción Técnica Emisores Electrónicos, "Restricciones de
        // Contenido y/o Caracteres en los XML" → tabla de caracteres reservados
        // del QR. Ver docs/fec/REQUISITOS.md §3.7:
        expect(codificarParametro(' ')).toBe('%20');
        expect(codificarParametro('!')).toBe('%21');
        expect(codificarParametro('#')).toBe('%23');
        expect(codificarParametro('$')).toBe('%24');
        expect(codificarParametro('&')).toBe('%26');
        expect(codificarParametro("'")).toBe('%27');
        expect(codificarParametro('(')).toBe('%28');
        expect(codificarParametro(')')).toBe('%29');
        expect(codificarParametro('*')).toBe('%2A');
        expect(codificarParametro('+')).toBe('%2B');
        expect(codificarParametro(',')).toBe('%2C');
        expect(codificarParametro('/')).toBe('%2F');
        expect(codificarParametro(';')).toBe('%3B');
        expect(codificarParametro('=')).toBe('%3D');
        expect(codificarParametro('?')).toBe('%3F');
        expect(codificarParametro('@')).toBe('%40');
        expect(codificarParametro('[')).toBe('%5B');
        expect(codificarParametro(']')).toBe('%5D');
        expect(codificarParametro('"')).toBe('%22');
        expect(codificarParametro('<')).toBe('%3C');
        expect(codificarParametro('>')).toBe('%3E');
        expect(codificarParametro('\\')).toBe('%5C');
        expect(codificarParametro('^')).toBe('%5E');
        expect(codificarParametro('`')).toBe('%60');
        expect(codificarParametro('%')).toBe('%25');
    });

    it('un código de seguridad con base64 no rompe la URL', () => {
        // Un SignatureValue en base64 puede empezar por `+`, `/` o `=`; esos
        // caracteres tendrían significado especial en la query string.
        expect(codificarParametro('ab+/=')).toBe('ab%2B%2F%3D');
        expect(codificarParametro('a b')).toBe('a%20b');
    });

    it('lo que la DGII deja crudo en sus ejemplos se deja crudo', () => {
        expect(codificarParametro('6225.09')).toBe('6225.09');
        expect(codificarParametro('10-10-2020 09:00:00')).toBe('10-10-2020%2009:00:00');
        expect(codificarParametro('dcp79q')).toBe('dcp79q');
    });
});

describe('QR del timbre — elección de consulta', () => {
    const base = {
        ambiente: 'testecf' as const,
        rncEmisor: '131880738',
        rncComprador: '131880739',
        encf: 'E310000000001',
        fechaEmision: '26-09-2026',
        fechaFirma: '26-09-2026 10:30:00',
        codigoSeguridad: 'abc123',
    };

    it('E31 y E34 siempre usan la consulta general', () => {
        expect(urlTimbrePara(31, 100, base)).toContain('/testecf/consultatimbre?');
        expect(urlTimbrePara(34, 100, base)).toContain('/testecf/consultatimbre?');
    });

    it('E32 menor a RD$250,000 usa el timbre de Factura de Consumo', () => {
        expect(UMBRAL_CONSUMO).toBe(250_000);
        const url = urlTimbrePara(32, 6225.09, base);
        expect(url).toContain('fc.dgii.gov.do/testecf/consultatimbrefc?');
        expect(url).not.toContain('rnccomprador');
        expect(url).toContain('montototal=6225.09');
    });

    it('E32 igual o mayor a RD$250,000 usa la consulta general', () => {
        const url = urlTimbrePara(32, 250_000, base);
        expect(url).toContain('/testecf/consultatimbre?');
        expect(url).toContain('rnccomprador=131880739');
    });

    it('omite rnccomprador cuando el comprador no tiene RNC', () => {
        const url = urlTimbreEcf({ ...base, rncComprador: undefined });
        expect(url).not.toContain('rnccomprador');
        expect(url).toContain('&encf=');
    });
});
