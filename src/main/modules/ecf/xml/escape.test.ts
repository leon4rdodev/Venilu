import { describe, it, expect } from 'vitest';
import { escapeXml, isBlankValue } from './escape';

/**
 * Fuente: DGII — "Descripción Técnica Emisores Electrónicos", sección
 * "Restricciones de Contenido y/o Caracteres en los XML".
 *
 *   "En la información 'ALFANUM' dentro de los XML a generar y enviar, los
 *    siguientes caracteres no deben emplearse, ya que tienen un significado
 *    por sí solos y deberán ser remplazados por definiciones estándar
 *    especificadas a continuación"
 *
 * Las 8 filas de la tabla se prueban una por una. Para ©/€/® se prueba la
 * referencia NUMÉRICA (de las tres variantes que ofrece la DGII, la única
 * válida en XML 1.0 sin DTD).
 *
 * Ver `docs/fec/REQUISITOS.md` §1.4 y `docs/fec/FUENTES.md`.
 */
describe('escapeXml — tabla oficial de la DGII', () => {
    const tabla: ReadonlyArray<readonly [string, string, string]> = [
        ['"', '&quot;', '&#34; / &#x22;'],
        ["'", '&apos;', '&#39; / &#x27;'],
        ['<', '&lt;', '&#60; / &#x3C;'],
        ['>', '&gt;', '&#62; / &#x3E;'],
        ['&', '&amp;', '&#38; / &#x26;'],
        ['\u00A9', '&#169;', '© — &#169; / &#xA9;'],
        ['\u20AC', '&#8364;', '€ — &#8364; / &#x20AC;'],
        ['\u00AE', '&#174;', '® — &#174; / &#xAE;'],
    ];

    for (const [crudo, esperado, etiqueta] of tabla) {
        it(`escapa ${etiqueta}`, () => {
            expect(escapeXml(`a${crudo}b`)).toBe(`a${esperado}b`);
        });
    }

    it('no altera texto plano', () => {
        expect(escapeXml('Factura 001-00000001 (RNC 1-30-12345-6)')).toBe(
            'Factura 001-00000001 (RNC 1-30-12345-6)'
        );
    });

    it('escapa en cadena: "&" primero para no doble-escapar', () => {
        expect(escapeXml('&copy;')).toBe('&amp;copy;');
    });

    it('aplica todas las reglas a la vez', () => {
        expect(escapeXml('a<b>&"c"©€®')).toBe('a&lt;b&gt;&amp;&quot;c&quot;&#169;&#8364;&#174;');
    });
});

describe('isBlankValue — "no deberá incluirse tags vacíos"', () => {
    it('trata undefined, null y string en blanco como vacíos', () => {
        expect(isBlankValue(undefined)).toBe(true);
        expect(isBlankValue(null)).toBe(true);
        expect(isBlankValue('')).toBe(true);
        expect(isBlankValue('   ')).toBe(true);
    });

    it('NO trata 0 ni "0" como vacíos (son datos válidos)', () => {
        expect(isBlankValue(0)).toBe(false);
        expect(isBlankValue('0')).toBe(false);
        expect(isBlankValue(false)).toBe(false);
    });
});
