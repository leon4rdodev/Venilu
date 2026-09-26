import { escapeXml, isBlankValue } from './escape';
import { getParsedSchema, getRootNode, type SchemaNode, type SimpleTypeDef } from './xsd-model';

/** Tipos de comprobante electrónico que emite Venilu. */
export type EcfTipo = 31 | 32 | 34;

/** Cualquier valor escalar aceptado en un tag. */
export type XmlScalar = string | number | boolean;

/**
 * Árbol de entrada "crudo" cuyas claves son EXACTAMENTE los nombres de tag del
 * XSD oficial de la DGII. Elegimos este formato a propósito: el mapeo se puede
 * auditar tag por tag contra `src/main/modules/ecf/schemas/ecf-3X.xsd`.
 */
export type EcfRawNode = {
    [tag: string]: XmlScalar | EcfRawNode | Array<EcfRawNode | XmlScalar> | undefined | null;
};

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

/* ------------------------------------------------------------------ */
/* Serialización                                                       */
/* ------------------------------------------------------------------ */

interface XmlNode {
    tag: string;
    text?: string;
    children?: XmlNode[];
}

function scalarToText(
    value: XmlScalar,
    type: SimpleTypeDef | undefined,
    path: string
): string {
    if (typeof value === 'string') return value;

    const base = type?.base ?? 'string';

    if (base === 'decimal' || base === 'integer' || INTEGER_BASES.has(base)) {
        const n = typeof value === 'boolean' ? (value ? 1 : 0) : Number(value);
        if (!Number.isFinite(n)) {
            throw new Error(`${path}: valor numérico no finito (${String(value)})`);
        }
        const decimals = type?.fractionDigits ?? (INTEGER_BASES.has(base) || base === 'integer' ? 0 : 2);
        if (decimals === 0) return String(Math.round(n));
        // Redondeo "regla de redondeos" de la DGII al máximo de decimales que
        // admite el propio XSD, y sin ceros colgantes (todo formato es válido
        // para el patrón [0-9]{1,16}(\.[0-9]{1,2})? de la DGII).
        const fixed = n.toFixed(decimals);
        return fixed.includes('.') ? fixed.replace(/\.?0+$/, '') || '0' : fixed;
    }

    if (typeof value === 'boolean') return value ? '1' : '0';
    return String(value);
}

const INTEGER_BASES = new Set([
    'integer', 'int', 'long', 'short', 'byte', 'nonNegativeInteger',
    'positiveInteger', 'nonPositiveInteger', 'negativeInteger', 'unsignedInt',
    'unsignedLong', 'unsignedShort', 'unsignedByte',
]);

function renderNode(
    node: XmlNode,
    out: string[]
): void {
    const { tag, text, children } = node;
    if (text !== undefined) {
        out.push('<', tag, '>', escapeXml(text), '</', tag, '>');
        return;
    }
    out.push('<', tag, '>');
    for (const child of children ?? []) renderNode(child, out);
    out.push('</', tag, '>');
}

/* ------------------------------------------------------------------ */
/* Render guiado por el XSD oficial                                    */
/* ------------------------------------------------------------------ */

/**
 * Recorre la secuencia del XSD e imprime, **en el orden exacto del esquema**,
 * únicamente los tags del input que existen para ese tipo de comprobante.
 *
 * Al derivar el orden y la presencia de cada tag del propio XSD oficial, el
 * builder no puede "adivinar": lo que no esté en el esquema se descarta, lo
 * que esté obligatorio y falte lo detecta después la validación XSD, y ningún
 * tag vacío llega a serializarse.
 */
function renderThroughSchema(
    schemaNode: SchemaNode,
    input: EcfRawNode,
    path: string,
    descartados: string[],
    out: XmlNode[]
): void {
    const children = schemaNode.children;
    if (!children) {
        throw new Error(`${path}: el esquema no define hijos para ${schemaNode.name}`);
    }

    const used = new Set<string>();

    for (const def of children) {
        if (def.any) {
            // Slot de la firma digital (<xs:any minOccurs="1" maxOccurs="1">).
            // Se rellena aparte, nunca a partir del input de negocio.
            continue;
        }

        const raw = input[def.name];
        used.add(def.name);
        if (isBlankValue(raw)) continue;

        const childPath = `${path}/${def.name}`;
        const values = Array.isArray(raw) ? raw : [raw];

        if (values.length === 0) continue;
        if (values.length > 1 && def.maxOccurs <= 1) {
            throw new Error(
                `${childPath}: el XSD admite máximo ${def.maxOccurs} ocurrencia(s), se recibieron ${values.length}`
            );
        }

        for (const value of values) {
            if (isBlankValue(value)) continue;
            if (def.children) {
                if (value === null || typeof value !== 'object' || Array.isArray(value)) {
                    throw new Error(`${childPath}: se esperaba un objeto de tags interno`);
                }
                const node: XmlNode = { tag: def.name, children: [] };
                renderThroughSchema(def, value, childPath, descartados, node.children!);
                out.push(node);
            } else {
                if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                    throw new Error(`${childPath}: el XSD lo define como dato simple, no como grupo`);
                }
                out.push({
                    tag: def.name,
                    text: scalarToText(value as XmlScalar, def.simple, childPath),
                });
            }
        }
    }

    for (const key of Object.keys(input)) {
        if (!used.has(key)) descartados.push(`${path}/${key}`);
    }
}

/* ---------------------------------------------------------------- API -- */

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

    const descartados: string[] = [];
    const children: XmlNode[] = [];
    renderThroughSchema(root, raw, `/${root.name}`, descartados, children);

    const parts: string[] = [];
    renderNode({ tag: root.name, children }, parts);
    return { xml: `<?xml version="1.0" encoding="UTF-8"?>${parts.join('')}`, descartados };
}
