import { describe, it, expect } from 'vitest';
import { buildAnecfXml, cantidadRango } from './build-anecf';
import { validateAnecf, formatIssues } from './xsd-validator';
import { SCHEMAS } from '../schemas';

describe('ANECF — anulación de e-NCF (Formato Anulación de e-NCF v1.0)', () => {
    it('el XSD embebido es el oficial (sha256)', () => {
        expect(SCHEMAS.anecf.sha256).toBe('af2e6a16c2900dfa55264d6ebec58ccbbbb25c1eb9821ee18ccc44fc142d0e78');
    });

    it('reproduce el ejemplo del Anexo I y valida contra el XSD (sin firma)', () => {
        // Anexo I usa los tipos 31 y 44; Venilu solo emite 31/32/34, así que
        // la segunda línea del ejemplo se reproduce con el tipo 34.
        const { xml, total } = buildAnecfXml({
            rncEmisor: '123456789',
            fechaHora: '01-01-2019 08:50:15',
            lineas: [
                {
                    tipo: 31,
                    rangos: [
                        { desde: 'E310000000001', hasta: 'E310000000001' },
                        { desde: 'E310000000005', hasta: 'E310000000050' },
                    ],
                },
                { tipo: 34, rangos: [{ desde: 'E340000000010', hasta: 'E340000000046' }] },
            ],
        });
        expect(total).toBe(84); // 1 + 46 + 37, igual que el ejemplo oficial
        expect(xml).toContain('<CantidadeNCFAnulados>47</CantidadeNCFAnulados>');
        expect(xml).toContain('<CantidadeNCFAnulados>37</CantidadeNCFAnulados>');
        expect(xml).toContain('<NoLinea>2</NoLinea>');
        const check = validateAnecf(xml, { requireSignature: false });
        expect(check.valid, formatIssues(check)).toBe(true);
    });

    it('cuenta ambos extremos del rango', () => {
        expect(cantidadRango({ desde: 'E320000000005', hasta: 'E320000000050' })).toBe(46);
    });

    it('rechaza rangos que no cumplen las validaciones del formato', () => {
        const base = { rncEmisor: '123456789', fechaHora: '01-01-2026 10:00:00' };
        const con = (desde: string, hasta: string, tipo: 31 | 32 | 34 = 32) =>
            () => buildAnecfXml({ ...base, lineas: [{ tipo, rangos: [{ desde, hasta }] }] });

        expect(con('E320000000009', 'E320000000005')).toThrow(/mayor al del campo SecuenciaeNCFHasta/);
        expect(con('E310000000001', 'E310000000002')).toThrow(/no es del tipo 32/);
        expect(con('E320000000001', 'F320000000002')).toThrow(/misma serie/);
        expect(con('P320000000001', 'P320000000002')).toThrow(/no es un e-NCF válido/);
        expect(con('E32000000001', 'E320000000002')).toThrow(/no es un e-NCF válido/);
        expect(con('E320000000000', 'E320000000002')).toThrow(/mayores a cero/);
        expect(() =>
            buildAnecfXml({
                ...base,
                lineas: [
                    { tipo: 32, rangos: [{ desde: 'E320000000001', hasta: 'E320000000001' }] },
                    { tipo: 32, rangos: [{ desde: 'E320000000003', hasta: 'E320000000003' }] },
                ],
            })
        ).toThrow(/dos líneas/);
    });
});
