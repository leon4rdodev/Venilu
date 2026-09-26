// Tipos de @xmldom/xmldom: el proyecto también tiene lib DOM global, así
// que hay que distinguirlos explícitamente de `Element`/`Document`/`Node`
// del navegador.
import {
    DOMParser,
    type Document as XmlDocument,
    type Element as XmlElement,
    type Node as XmlNode,
} from '@xmldom/xmldom';
import { SCHEMAS, type SchemaEntry, type SchemaName } from '../schemas';

/**
 * Compilador de los XSD **oficiales** de la DGII a un modelo en memoria.
 *
 * Todas las restricciones (orden, obligatoriedad, cardinalidad, patrones,
 * enumeraciones, decimales) se leen de los propios archivos `.xsd` descargados
 * de dgii.gov.do; ninguna se reimplementa a mano. Ver `docs/fec/FUENTES.md`.
 *
 * Los XSD de la DGII usan exclusivamente: `xs:sequence`, `xs:element`,
 * `xs:complexType`, `xs:simpleType/restriction`, `xs:any` (slot de firma) y
 * restricciones simples. El resto (choice, group, atributos…) se rechaza de
 * forma explícita para que un XSD nuevo no pase inadvertido.
 */

export interface SimpleTypeDef {
    /** Tipo base XSD (`xs:decimal`, `xs:string`, `xs:integer`, `xs:dateTime`…). */
    base: string;
    enumerations?: string[];
    patterns?: string[];
    minLength?: number;
    maxLength?: number;
    totalDigits?: number;
    fractionDigits?: number;
    minInclusive?: number;
    maxInclusive?: number;
    minExclusive?: number;
    maxExclusive?: number;
}

export interface SchemaNode {
    name: string;
    minOccurs: number;
    /** `Infinity` cuando el XSD dice `unbounded`. */
    maxOccurs: number;
    /** true para el `<xs:any>` que aloja la firma digital. */
    any?: boolean;
    /** Presente ⇒ elemento compuesto (grupo de tags internos). */
    children?: SchemaNode[];
    /** Presente ⇒ dato simple con restricciones. */
    simple?: SimpleTypeDef;
}

export interface ParsedSchema {
    entry: SchemaEntry;
    root: SchemaNode;
}

const XSD_NS = 'http://www.w3.org/2001/XMLSchema';

function isElement(node: XmlNode | null | undefined, localName?: string): node is XmlElement {
    if (!node || (node as XmlElement).nodeType !== 1) return false;
    return localName ? (node as XmlElement).localName === localName : true;
}

function childrenOf(el: XmlElement): XmlElement[] {
    const out: XmlElement[] = [];
    for (let c = el.firstChild; c; c = c.nextSibling) {
        if ((c as XmlElement).nodeType === 1) out.push(c as XmlElement);
    }
    return out;
}

function attr(el: XmlElement, name: string): string | null {
    const v = el.getAttribute(name);
    return v === null || v === '' ? null : v;
}

/**
 * Un `name`/`type` de XSD es una QName: no puede contener espacios.
 *
 * DEFECTO CONFIRMADO en el XSD oficial de la DGII `e-CF 31 v.1.0.xsd`
 * (línea 476): declara
 *
 *     <xs:simpleType name=" IndicadorServicioTodoIncluidoType">
 *
 * con un espacio inicial, por lo que la referencia
 * `type="IndicadorServicioTodoIncluidoType"` de la línea 18 no resuelve y
 * **el esquema entero deja de compilar**. Verificado con libxml2 2.15.3:
 *
 *     WXS schema ecf-31.xsd failed to compile
 *     The QName value 'IndicadorServicioTodoIncluidoType' does not resolve
 *     to a(n) type definition.
 *
 * Los otros cuatro XSD (e-CF 32, e-CF 34, RFCE 32 y Semilla) compilan bien.
 * Se recorta el espaciado por higiene, sin modificar el archivo oficial
 * (su sha256 sigue siendo el de la descarga).
 */
function qname(value: string | null): string | null {
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
}

function occurs(el: XmlElement, name: 'minOccurs' | 'maxOccurs', fallback: number): number {
    const raw = attr(el, name);
    if (raw === null) return fallback;
    if (raw === 'unbounded') return Infinity;
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
        throw new Error(`XSD: valor de ${name} inválido: ${raw}`);
    }
    return n;
}

/* ------------------------------------------------------------------ */

class SchemaCompiler {
    private readonly doc: XmlDocument;
    private readonly namedSimple = new Map<string, SimpleTypeDef>();
    private readonly namedComplex = new Map<string, XmlElement>();

    constructor(xsdText: string) {
        // Los XSD de la DGII (ecf-32.xsd, ecf-34.xsd) vienen con BOM UTF-8;
        // hay que quitarlo para que el `<?xml …?>` quede en la posición 0.
        this.doc = new DOMParser().parseFromString(xsdText.replace(/^\uFEFF/, ''), 'text/xml');
        const schema = this.doc.documentElement;
        if (!isElement(schema, 'schema')) {
            throw new Error('El archivo no es un XSD (falta <xs:schema>)');
        }
        for (const child of childrenOf(schema)) {
            if (child.namespaceURI && child.namespaceURI !== XSD_NS) continue;
            if (child.localName === 'simpleType') {
                const name = qname(attr(child, 'name'));
                if (name) this.namedSimple.set(name, this.compileSimple(child, name));
            } else if (child.localName === 'complexType') {
                const name = qname(attr(child, 'name'));
                if (name) this.namedComplex.set(name, child);
            }
        }
    }

    root(): SchemaNode {
        const schema = this.doc.documentElement;
        if (!schema) throw new Error('El XSD no tiene elemento raíz.');
        for (const child of childrenOf(schema)) {
            if (child.localName === 'element' && qname(attr(child, 'name'))) {
                return this.compileElement(child, 1, 1);
            }
        }
        throw new Error('El XSD no define ningún elemento global');
    }

    private compileElement(el: XmlElement, minOccurs: number, maxOccurs: number): SchemaNode {
        const name = qname(attr(el, 'name'));
        if (!name) throw new Error('XSD: <xs:element> sin nombre (ref no soportado)');

        const node: SchemaNode = { name, minOccurs, maxOccurs };

        const inlineSimple = childrenOf(el).find((c) => c.localName === 'simpleType');
        if (inlineSimple) {
            node.simple = this.compileSimple(inlineSimple, `${name} (inline)`);
            return node;
        }

        const inlineComplex = childrenOf(el).find((c) => c.localName === 'complexType');
        if (inlineComplex) {
            node.children = this.compileContent(inlineComplex, name);
            return node;
        }

        const typeRef = qname(attr(el, 'type'));
        if (!typeRef) throw new Error(`XSD: elemento "${name}" sin tipo`);

        const named = this.resolveSimple(typeRef, name);
        if (named) {
            node.simple = named;
            return node;
        }

        const complex = this.namedComplex.get(typeRef.trim());
        if (complex) {
            node.children = this.compileContent(complex, name);
            return node;
        }

        throw new Error(`XSD: tipo "${typeRef}" de "${name}" no reconocido`);
    }

    /** Devuelve el SimpleTypeDef si `ref` resuelve a un tipo simple. */
    private resolveSimple(rawRef: string, context: string): SimpleTypeDef | undefined {
        const ref = rawRef.trim();
        if (ref.startsWith('xs:') || ref.startsWith('xsd:')) {
            return { base: ref.replace(/^xsd:/, 'xs:').slice(3) };
        }
        const named = this.namedSimple.get(ref);
        if (!named) {
            throw new Error(`XSD: tipo simple "${ref}" de "${context}" no está definido`);
        }
        return named;
    }

    private compileSimple(el: XmlElement, context: string): SimpleTypeDef {
        const restriction = childrenOf(el).find((c) => c.localName === 'restriction');
        if (!restriction) {
            throw new Error(`XSD: simpleType "${context}" sin <xs:restriction> (list/union no soportados)`);
        }
        const base = qname(attr(restriction, 'base'));
        if (!base) throw new Error(`XSD: restriction de "${context}" sin base`);

        const def: SimpleTypeDef = {
            base: (base.startsWith('xsd:') ? base.slice(4) : base.replace(/^xs:/, '')).trim(),
        };

        for (const facet of childrenOf(restriction)) {
            const value = attr(facet, 'value');
            switch (facet.localName) {
                case 'enumeration':
                    if (value !== null) (def.enumerations ??= []).push(value);
                    break;
                case 'pattern':
                    if (value !== null) (def.patterns ??= []).push(value);
                    break;
                case 'minLength':
                    if (value !== null) def.minLength = Number(value);
                    break;
                case 'maxLength':
                    if (value !== null) def.maxLength = Number(value);
                    break;
                case 'totalDigits':
                    if (value !== null) def.totalDigits = Number(value);
                    break;
                case 'fractionDigits':
                    if (value !== null) def.fractionDigits = Number(value);
                    break;
                case 'minInclusive':
                    if (value !== null) def.minInclusive = Number(value);
                    break;
                case 'maxInclusive':
                    if (value !== null) def.maxInclusive = Number(value);
                    break;
                case 'minExclusive':
                    if (value !== null) def.minExclusive = Number(value);
                    break;
                case 'maxExclusive':
                    if (value !== null) def.maxExclusive = Number(value);
                    break;
                case 'annotation':
                    break;
                default:
                    throw new Error(
                        `XSD: facet "<xs:${facet.localName}>" no soportado en "${context}". ` +
                            'Hay que ampliar xsd-model.ts para poder seguir validando.'
                    );
            }
        }
        return def;
    }

    private compileContent(container: XmlElement, context: string): SchemaNode[] {
        const sequence = childrenOf(container).find((c) => c.localName === 'sequence');
        if (!sequence) {
            const unsupported = childrenOf(container)
                .map((c) => c.localName)
                .filter((n) => n !== 'annotation');
            throw new Error(
                `XSD: "${context}" no usa <xs:sequence> (contiene: ${unsupported.join(', ') || 'nada'}).`
            );
        }
        return this.compileSequence(sequence, context);
    }

    private compileSequence(sequence: XmlElement, context: string): SchemaNode[] {
        const out: SchemaNode[] = [];
        for (const child of childrenOf(sequence)) {
            switch (child.localName) {
                case 'element': {
                    const minOccurs = occurs(child, 'minOccurs', 1);
                    const maxOccurs = occurs(child, 'maxOccurs', 1);
                    out.push(this.compileElement(child, minOccurs, maxOccurs));
                    break;
                }
                case 'any': {
                    out.push({
                        name: '*',
                        minOccurs: occurs(child, 'minOccurs', 1),
                        maxOccurs: occurs(child, 'maxOccurs', 1),
                        any: true,
                    });
                    break;
                }
                case 'sequence':
                    out.push(...this.compileSequence(child, context));
                    break;
                case 'annotation':
                    break;
                default:
                    throw new Error(
                        `XSD: construcción "<xs:${child.localName}>" no soportada en "${context}".`
                    );
            }
        }
        return out;
    }
}

/* ------------------------------------------------------------------ */

const cache = new Map<string, ParsedSchema>();

function entryFor(name: SchemaName): SchemaEntry {
    const entry = (SCHEMAS as Record<string, SchemaEntry | undefined>)[name];
    if (!entry) throw new Error(`Esquema desconocido: ${name}`);
    return entry;
}

export function getParsedSchema(name: SchemaName): ParsedSchema {
    const cached = cache.get(name);
    if (cached) return cached;
    const entry = entryFor(name);
    const parsed: ParsedSchema = {
        entry,
        root: new SchemaCompiler(entry.xsd).root(),
    };
    cache.set(name, parsed);
    return parsed;
}

export function getRootNode(parsed: ParsedSchema): SchemaNode {
    return parsed.root;
}

/** ¿El esquema sigue siendo el archivo oficial con ese hash? (prueba de procedencia) */
export function verifySchemaIntegrity(name: SchemaName, sha256: string): boolean {
    return entryFor(name).sha256 === sha256;
}
