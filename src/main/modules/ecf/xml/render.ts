import { escapeXml, isBlankValue } from './escape';
import type { SchemaNode, SimpleTypeDef } from './xsd-model';

/** Cualquier valor escalar aceptado en un tag. */
export type XmlScalar = string | number | boolean;

/**
 * Árbol de entrada "crudo" cuyas claves son EXACTAMENTE los nombres de tag del
 * XSD oficial de la DGII. Elegimos este formato a propósito: el mapeo se puede
 * auditar tag por tag contra `src/main/modules/ecf/schemas/*.xsd`.
 */
export type RawNode = {
    [tag: string]: XmlScalar | RawNode | Array<RawNode | XmlScalar> | undefined | null;
};

export interface XmlNode {
    tag: string;
    text?: string;
    children?: XmlNode[];
}

const INTEGER_BASES = new Set([
    'integer', 'int', 'long', 'short', 'byte', 'nonNegativeInteger',
    'positiveInteger', 'nonPositiveInteger', 'negativeInteger', 'unsignedInt',
    'unsignedLong', 'unsignedShort', 'unsignedByte',
]);

export function scalarToText(
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

export function renderNode(node: XmlNode, out: string[]): void {
    const { tag, text, children } = node;
    if (text !== undefined) {
        out.push('<', tag, '>', escapeXml(text), '</', tag, '>');
        return;
    }
    out.push('<', tag, '>');
    for (const child of children ?? []) renderNode(child, out);
    out.push('</', tag, '>');
}

/**
 * Recorre la secuencia del XSD e imprime, **en el orden exacto del esquema**,
 * únicamente los tags del input que existen para ese tipo de comprobante.
 *
 * Al derivar el orden y la presencia de cada tag del propio XSD oficial, el
 * builder no puede "adivinar": lo que no esté en el esquema se descarta, lo
 * que esté obligatorio y falte lo detecta después la validación XSD, y ningún
 * tag vacío llega a serializarse.
 */
export function renderThroughSchema(
    schemaNode: SchemaNode,
    input: RawNode,
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

/** Serializa la raíz con declaración `<?xml ?>` y devuelve XML + descartes. */
export function serializeRoot(
    schemaNode: SchemaNode,
    raw: RawNode
): { xml: string; descartados: string[] } {
    const descartados: string[] = [];
    const children: XmlNode[] = [];
    renderThroughSchema(schemaNode, raw, `/${schemaNode.name}`, descartados, children);

    const parts: string[] = [];
    renderNode({ tag: schemaNode.name, children }, parts);
    return { xml: `<?xml version="1.0" encoding="UTF-8"?>${parts.join('')}`, descartados };
}
