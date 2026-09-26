import { getParsedSchema, getRootNode } from './xsd-model';
import { serializeRoot, type RawNode } from './render';

/** Tipos de comprobante electrónico que emite Venilu. */
export type EcfTipo = 31 | 32 | 34;

/** Cualquier valor escalar aceptado en un tag. */
export type { XmlScalar } from './render';

/**
 * Árbol de entrada "crudo" cuyas claves son EXACTAMENTE los nombres de tag del
 * XSD oficial de la DGII. Elegimos este formato a propósito: el mapeo se puede
 * auditar tag por tag contra `src/main/modules/ecf/schemas/ecf-3X.xsd`.
 */
export type EcfRawNode = RawNode;

export interface BuildEcfInput {
    tipo: EcfTipo;
    /** e-NCF asignado: `E` + 2 dígitos de tipo + 10 secuenciales = 13 caracteres. */
    encf: string;
    /** Fecha/hora de la firma en `dd-MM-yyyy HH:mm:ss` (DateTimeValidationType). */
    fechaHoraFirma: string;
    /** Contenido de <Encabezado> SIN Version/TipoeCF/eNCF, que se inyectan solos. */
    encabezado: EcfRawNode;
    /** Contenido de <DetallesItems> (típicamente `{ Item: [...] }`). */
    detallesItems: EcfRawNode;
    /** Secciones opcionales de raíz ECF, inyectadas después de DetallesItems. */
    seccionesRaiz?: Record<string, EcfRawNode | EcfRawNode[] | undefined | null>;
}

export interface BuildEcfResult {
    /** XML completo, con declaración <?xml ?>. Todavía SIN firmar. */
    xml: string;
    /** Tags del input descartados porque no existen en el XSD del tipo pedido. */
    descartados: string[];
}

/**
 * Construye el XML de un e-CF **sin firmar**, listo para validarlo contra el
 * XSD oficial y después firmarlo con el certificado digital.
 *
 * Estructura garantizada (XSD e-CF 31/32/34 v1.0, DGII):
 *
 *   <ECF>
 *     <Encabezado>…</Encabezado>
 *     <DetallesItems>…</DetallesItems>
 *     [secciones opcionales de raíz]
 *     <FechaHoraFirma>dd-MM-yyyy HH:mm:ss</FechaHoraFirma>
 *   </ECF>
 *
 * Nota: el `<Signature>` se inserta al firmar, ocupando el único slot
 * `xs:any processContents="skip" minOccurs="1" maxOccurs="1"` que el XSD
 * deja después de `<FechaHoraFirma>`.
 */
export function buildEcfXml(input: BuildEcfInput): BuildEcfResult {
    const schema = getParsedSchema(`ecf-${input.tipo}`);
    const root = getRootNode(schema);

    if (root.name !== 'ECF') {
        throw new Error(`El XSD de tipo ${input.tipo} tiene raíz "${root.name}", se esperaba "ECF"`);
    }

    const encabezado: EcfRawNode = {
        ...input.encabezado,
        Version: '1.0',
        IdDoc: {
            TipoeCF: input.tipo,
            eNCF: input.encf,
            ...(typeof input.encabezado.IdDoc === 'object' && !Array.isArray(input.encabezado.IdDoc)
                ? input.encabezado.IdDoc
                : {}),
        },
    };

    const raw: EcfRawNode = {
        Encabezado: encabezado,
        DetallesItems: input.detallesItems,
        ...(input.seccionesRaiz ?? {}),
        FechaHoraFirma: input.fechaHoraFirma,
    };

    return serializeRoot(root, raw);
}
