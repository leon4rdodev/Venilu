/**
 * Incrusta los XSD oficiales de la DGII como constantes de TypeScript.
 *
 * Motivo: los XSD son archivos no-TS, por lo que `tsc` no los copia a
 * `dist-electron`. Incrustarlos garantiza que la validación local contra el
 * esquema oficial funcione igual en desarrollo, pruebas y build empaquetado
 * (asar), sin resolver rutas en tiempo de ejecución.
 *
 * Fuente de verdad: src/main/modules/ecf/schemas/*.xsd (descargados de
 * https://dgii.gov.do — ver docs/fec/FUENTES.md).
 *
 * Uso: node scripts/gen-xsd.mjs
 */
/* global console */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const schemasDir = path.join(root, 'src/main/modules/ecf/schemas');
const outFile = path.join(schemasDir, 'xsd.generated.ts');

const constName = (file) =>
  file.replace(/\.xsd$/, '').replace(/[^A-Za-z0-9]+/g, '_').toUpperCase() + '_XSD';

const files = readdirSync(schemasDir)
  .filter((f) => f.endsWith('.xsd'))
  .sort();

const blocks = files.map((file) => {
  const raw = readFileSync(path.join(schemasDir, file), 'utf8');
  const sha256 = createHash('sha256').update(raw).digest('hex');
  return {
    file,
    constName: constName(file),
    sha256,
    body: `/** ${file} — XSD oficial DGII (sha256: ${sha256}) */\nexport const ${constName(file)} = ${JSON.stringify(raw)};\n`,
  };
});

const header = `/**
 * ARCHIVO GENERADO AUTOMÁTICAMENTE — NO EDITAR A MANO.
 * Generado por: node scripts/gen-xsd.mjs
 *
 * Esquemas XSD oficiales de la DGII (República Dominicana) incrustados como
 * texto para validar los XML e-CF localmente antes de enviarlos.
 * Ver docs/fec/FUENTES.md para la procedencia exacta de cada archivo.
 */
`;

const index = `/**
 * ARCHIVO GENERADO AUTOMÁTICAMENTE — NO EDITAR A MANO.
 * Generado por: node scripts/gen-xsd.mjs
 */
import {
${blocks.map((b) => `  ${b.constName}`).join(',\n')}
} from './xsd.generated';

export interface SchemaEntry {
  /** Nombre del archivo XSD oficial. */
  file: string;
  /** Contenido completo del XSD. */
  xsd: string;
  /** sha256 del archivo original, para verificar procedencia. */
  sha256: string;
}

${blocks
  .map(
    (b) => `export const ${b.file.replace(/\.xsd$/, '').replace(/[^A-Za-z0-9]+/g, '_').toUpperCase()}: SchemaEntry = {
  file: ${JSON.stringify(b.file)},
  xsd: ${b.constName},
  sha256: ${JSON.stringify(b.sha256)},
};`
  )
  .join('\n\n')}

export const SCHEMAS = {
${blocks
  .map(
    (b) =>
      `  ${JSON.stringify(b.file.replace(/\.xsd$/, ''))}: ${b.file
        .replace(/\.xsd$/, '')
        .replace(/[^A-Za-z0-9]+/g, '_')
        .toUpperCase()},`
  )
  .join('\n')}
} as const;

export type SchemaName = keyof typeof SCHEMAS;
`;

writeFileSync(outFile, header + blocks.map((b) => b.body).join('\n'), 'utf8');
writeFileSync(path.join(schemasDir, 'index.ts'), index, 'utf8');

for (const b of blocks) console.log(`${b.file.padEnd(16)} -> ${b.constName} (${b.sha256.slice(0, 12)}…)`);
