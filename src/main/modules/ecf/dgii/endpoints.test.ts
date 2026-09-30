import { describe, it, expect } from 'vitest';
import { formatoFecha, formatoFechaHora, nombreArchivoXml, AMBIENTES, CONSULTAS } from './endpoints';

/** Patrón literal de `DateTimeValidationType` en los XSD de la DGII. */
const PATRON_FECHA_HORA =
    /(3[01]|[12][0-9]|0[1-9])-(1[0-2]|0[1-9])-((19|20)\d{2}) (2[0-3]|[01]?[0-9]):([0-5]?[0-9]):([0-5]?[0-9])/;

describe('formatoFechaHora — zona horaria GMT-4', () => {
    it('convierte la hora UTC a GMT-4', () => {
        // 12:00 UTC → 08:00 GMT-4
        expect(formatoFechaHora(new Date('2026-09-26T12:00:00Z'))).toBe('26-09-2026 08:00:00');
        // 23:30 UTC → 19:30 GMT-4
        expect(formatoFechaHora(new Date('2026-09-26T23:30:00Z'))).toBe('26-09-2026 19:30:00');
    });

    it('corre el día cuando la medianoche está cerca', () => {
        // 02:30 UTC → 22:30 del día anterior
        expect(formatoFechaHora(new Date('2026-09-26T02:30:00Z'))).toBe('25-09-2026 22:30:00');
        // 00:00 UTC del 1 de enero → 20:00 del 31 de diciembre
        expect(formatoFechaHora(new Date('2026-01-01T00:00:00Z'))).toBe('31-12-2025 20:00:00');
    });

    it('cumple el patrón y el largo de 19 que exige el XSD', () => {
        const valor = formatoFechaHora(new Date('2026-09-26T12:00:00Z'));
        expect(valor).toHaveLength(19);
        expect(PATRON_FECHA_HORA.test(valor)).toBe(true);
    });

    it('no depende de la zona horaria de la máquina', () => {
        // Misma marca de tiempo, distinto resultado solo si se usara la hora local.
        const zonas = ['UTC', 'America/Santo_Domingo', 'Asia/Tokyo'];
        const original = process.env.TZ;
        const resultados: string[] = [];
        try {
            for (const zona of zonas) {
                process.env.TZ = zona;
                resultados.push(formatoFechaHora(new Date('2026-09-26T12:00:00Z')));
            }
        } finally {
            if (original === undefined) delete process.env.TZ;
            else process.env.TZ = original;
        }
        expect(new Set(resultados).size).toBe(1);
    });
});

describe('nombreArchivoXml', () => {
    it('es RNC+e-NCF.xml, el estándar que exige la DGII', () => {
        expect(nombreArchivoXml('101672919', 'E310000000001')).toBe('101672919E310000000001.xml');
        expect(nombreArchivoXml('101672919', 'E320000000001')).toBe('101672919E320000000001.xml');
    });
});

describe('endpoints de consulta', () => {
    it('cada ambiente de la DGII tiene su propia URL', () => {
        for (const a of AMBIENTES) {
            expect(CONSULTAS.porTrackId(a)).toBe(
                `https://ecf.dgii.gov.do/${a}/consultaresultado/api/consultas/estado`
            );
            expect(CONSULTAS.rfce(a)).toBe(
                `https://fc.dgii.gov.do/${a}/consultarfce/api/Consultas/Consulta`
            );
        }
    });
});

describe('formatoFecha', () => {
    it('produce dd-MM-yyyy', () => {
        expect(formatoFecha(new Date(2026, 0, 5))).toBe('05-01-2026');
    });
});
