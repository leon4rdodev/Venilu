/**
 * ARCHIVO GENERADO AUTOMÁTICAMENTE — NO EDITAR A MANO.
 * Generado por: node scripts/gen-xsd.mjs
 */
import {
  ECF_31_XSD,
  ECF_32_XSD,
  ECF_34_XSD,
  RFCE_32_XSD,
  SEMILLA_XSD
} from './xsd.generated';

export interface SchemaEntry {
  /** Nombre del archivo XSD oficial. */
  file: string;
  /** Contenido completo del XSD. */
  xsd: string;
  /** sha256 del archivo original, para verificar procedencia. */
  sha256: string;
}

export const ECF_31: SchemaEntry = {
  file: "ecf-31.xsd",
  xsd: ECF_31_XSD,
  sha256: "6f2909a93d84919518d2ae3c77fead4b35c3e8c95996b8af67b0040c2e2be298",
};

export const ECF_32: SchemaEntry = {
  file: "ecf-32.xsd",
  xsd: ECF_32_XSD,
  sha256: "151676df03c61335b4ac1eca97f99395488d57ea92793b49353602871e651f3c",
};

export const ECF_34: SchemaEntry = {
  file: "ecf-34.xsd",
  xsd: ECF_34_XSD,
  sha256: "6c62ebabdea9a6f6d62ae85d9e1c2eb788f44f3f0b61945fe116700c4eaac2da",
};

export const RFCE_32: SchemaEntry = {
  file: "rfce-32.xsd",
  xsd: RFCE_32_XSD,
  sha256: "6aad535875661b05eef072963295202fc94b3b320b257791feb8d3c39a5f8ee6",
};

export const SEMILLA: SchemaEntry = {
  file: "semilla.xsd",
  xsd: SEMILLA_XSD,
  sha256: "bebef2033c930a30c8cef45b513db00403423125a7f3f48e100a73e3e355f67e",
};

export const SCHEMAS = {
  "ecf-31": ECF_31,
  "ecf-32": ECF_32,
  "ecf-34": ECF_34,
  "rfce-32": RFCE_32,
  "semilla": SEMILLA,
} as const;

export type SchemaName = keyof typeof SCHEMAS;
