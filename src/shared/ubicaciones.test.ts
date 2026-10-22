import { describe, it, expect } from 'vitest';
import {
    esCodigoUbicacion,
    municipioEnProvincia,
    municipiosDe,
    nombreUbicacion,
    provincias,
} from './ubicaciones';

describe('catálogo de ubicaciones DGII (ProvinciaMunicipioType)', () => {
    it('trae las 32 provincias, incluido el Distrito Nacional', () => {
        const lista = provincias();
        expect(lista).toHaveLength(32);
        expect(lista[0]).toMatchObject({ codigo: '010000', nombre: 'DISTRITO NACIONAL' });
        expect(lista.every((p) => p.codigo.endsWith('0000'))).toBe(true);
    });

    it('quita el prefijo "PROVINCIA"/"MUNICIPIO" para mostrar', () => {
        expect(nombreUbicacion('020000')).toBe('AZUA');
        expect(nombreUbicacion('020100')).toBe('AZUA');
        expect(nombreUbicacion('020102')).toBe('BARRO ARRIBA (D. M.)');
    });

    it('lista municipios y distritos municipales de la provincia', () => {
        const azua = municipiosDe('020000');
        expect(azua.length).toBeGreaterThan(5);
        expect(azua.every((m) => m.codigo.startsWith('02') && !m.codigo.endsWith('0000'))).toBe(true);
        expect(municipioEnProvincia('020100', '020000')).toBe(true);
        expect(municipioEnProvincia('010100', '020000')).toBe(false);
    });

    it('rechaza códigos que no están en el XSD', () => {
        expect(esCodigoUbicacion('999999')).toBe(false);
        expect(esCodigoUbicacion('010000')).toBe(true);
        expect(municipiosDe('020100')).toEqual([]); // no es código de provincia
        expect(nombreUbicacion('999999')).toBe('');
    });
});
