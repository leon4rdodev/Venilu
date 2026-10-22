#!/usr/bin/env node
/**
 * Genera `src/shared/dgii-ubicaciones.ts` a partir del XSD oficial de la DGII.
 *
 * Fuente: `ProvinciaMunicipioType` de `e-CF 31/32/34 v.1.0.xsd`
 * (`src/main/modules/ecf/schemas/`). Cada `<xs:enumeration>` lleva el nombre
 * oficial en un comentario al lado:
 *
 *   <xs:enumeration value= "010000"/>	<!--DISTRITO NACIONAL -->
 *
 * Estructura del código (6 dígitos): PP MM DD
 *   PP0000 → provincia · PPMM00 → municipio · PPMMDD → distrito municipal.
 *
 * Los tres XSD deben traer la misma lista: si no, el script falla.
 *
 * Uso: `node scripts/gen-ubicaciones.mjs`
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dirXsd = path.join(raiz, 'src/main/modules/ecf/schemas');
const salida = path.join(raiz, 'src/shared/dgii-ubicaciones.ts');

function leerLista(archivo) {
    const xsd = fs.readFileSync(path.join(dirXsd, archivo), 'utf8');
    const inicio = xsd.indexOf('name="ProvinciaMunicipioType"');
    if (inicio < 0) throw new Error(`${archivo}: no tiene ProvinciaMunicipioType`);
    const fin = xsd.indexOf('</xs:simpleType>', inicio);
    const bloque = xsd.slice(inicio, fin);
    const re = /<xs:enumeration\s+value=\s*"(\d{6})"\s*\/>\s*<!--([\s\S]*?)-->/g;
    const lista = [];
    for (const m of bloque.matchAll(re)) {
        lista.push([m[1], m[2].replace(/\s+/g, ' ').trim()]);
    }
    if (lista.length === 0) throw new Error(`${archivo}: lista vacía`);
    return lista;
}

const listas = ['ecf-31.xsd', 'ecf-32.xsd', 'ecf-34.xsd'].map((f) => [f, leerLista(f)]);
const [, base] = listas[0];
for (const [archivo, lista] of listas.slice(1)) {
    if (JSON.stringify(lista) !== JSON.stringify(base)) {
        throw new Error(`${archivo}: ProvinciaMunicipioType difiere de ecf-31.xsd`);
    }
}

const filas = base.map(([c, n]) => `    ['${c}', ${JSON.stringify(n)}],`).join('\n');

const ts = `/* eslint-disable */
// ARCHIVO GENERADO por scripts/gen-ubicaciones.mjs — NO EDITAR A MANO.
// Fuente: ProvinciaMunicipioType de los XSD oficiales e-CF 31/32/34 v.1.0
// (src/main/modules/ecf/schemas/). ${base.length} códigos.

/** [código DGII de 6 dígitos, nombre oficial] */
export const UBICACIONES_DGII: ReadonlyArray<readonly [string, string]> = [
${filas}
];
`;

fs.writeFileSync(salida, ts);
console.log(`${path.relative(raiz, salida)}: ${base.length} códigos`);
