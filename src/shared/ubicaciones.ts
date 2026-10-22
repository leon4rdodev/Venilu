import { UBICACIONES_DGII } from './dgii-ubicaciones';

/**
 * Catálogo de provincias y municipios de la DGII (`ProvinciaMunicipioType` de
 * los XSD oficiales e-CF). Códigos de 6 dígitos `PPMMDD`:
 *
 *   PP0000 → provincia (o el Distrito Nacional, `010000`)
 *   PPMM00 → municipio
 *   PPMMDD → distrito municipal (D. M.)
 *
 * El XSD admite cualquier código de la lista en `<Municipio>` y `<Provincia>`;
 * en Ajustes se ofrece la provincia (PP0000) y, dentro de ella, municipios y
 * distritos municipales.
 */

export interface Ubicacion {
    codigo: string;
    /** Nombre oficial tal cual viene en el XSD. */
    oficial: string;
    /** Nombre para mostrar: sin el prefijo "PROVINCIA "/"MUNICIPIO ". */
    nombre: string;
}

const NOMBRES = new Map<string, string>(UBICACIONES_DGII.map(([c, n]) => [c, n]));

function limpiar(oficial: string): string {
    return oficial
        .replace(/^(PROVINCIA|MUNICIPIO)\s+/i, '')
        .replace(/\s*\(D\. ?M\.\)\.?$/i, ' (D. M.)')
        .trim();
}

function ubicacion(codigo: string, oficial: string): Ubicacion {
    return { codigo, oficial, nombre: limpiar(oficial) };
}

/** `true` si el código existe en el catálogo oficial. */
export function esCodigoUbicacion(codigo: string | null | undefined): boolean {
    return !!codigo && NOMBRES.has(codigo);
}

/** Nombre legible de un código (o `''` si no existe). */
export function nombreUbicacion(codigo: string | null | undefined): string {
    if (!codigo) return '';
    const oficial = NOMBRES.get(codigo);
    return oficial ? limpiar(oficial) : '';
}

/** Las 32 provincias (incluye el Distrito Nacional). */
export function provincias(): Ubicacion[] {
    return UBICACIONES_DGII
        .filter(([c]) => c.endsWith('0000'))
        .map(([c, n]) => ubicacion(c, n));
}

/** Municipios y distritos municipales de una provincia (código PP0000). */
export function municipiosDe(provincia: string | null | undefined): Ubicacion[] {
    if (!provincia || !/^\d{2}0000$/.test(provincia)) return [];
    const pp = provincia.slice(0, 2);
    return UBICACIONES_DGII
        .filter(([c]) => c.startsWith(pp) && !c.endsWith('0000'))
        .map(([c, n]) => ubicacion(c, n));
}

/** `true` si el municipio pertenece a la provincia. */
export function municipioEnProvincia(municipio: string, provincia: string): boolean {
    return municipiosDe(provincia).some((m) => m.codigo === municipio);
}
