import {
    DOMParser,
    onErrorStopParsing,
    type Document as XmlDocument,
    type Element as XmlElement,
    type Node as XmlNode,
} from '@xmldom/xmldom';
import type { SchemaName } from '../schemas';
import { getParsedSchema, type ParsedSchema, type SchemaNode, type SimpleTypeDef } from './xsd-model';

/**
 * Validador local contra los **XSD oficiales de la DGII**.
 *
 * No sustituye la validación de la DGII (CertECF/producción), pero permite
 * rechazar en el propio equipo cualquier XML que vaya a ser rechazado, sin
 * gastar intentos ni ensuciar la bitácora de certificación.
 *
 * Soporta exactamente el subconjunto XSD que usan los formatos de la DGII
 * (`xs:sequence`, `xs:element`, `xs:restriction` con facets, `xs:any`); si un
 * XSD futuro usa algo más, `xsd-model.ts` lanza un error explícito.
 */

export interface ValidationIssue {
    /** Ruta XPath-ish del tag con problemas. */
    path: string;
    message: string;
}

export interface ValidationResult {
    valid: boolean;
    issues: ValidationIssue[];
}

const NUMERIC_BASES = new Set([
    'decimal', 'integer', 'int', 'long', 'short', 'byte',
    'nonNegativeInteger', 'positiveInteger', 'nonPositiveInteger', 'negativeInteger',
    'unsignedInt', 'unsignedLong', 'unsignedShort', 'unsignedByte', 'double', 'float',
]);

const INTEGER_BASES = new Set([
    'integer', 'int', 'long', 'short', 'byte',
    'nonNegativeInteger', 'positiveInteger', 'nonPositiveInteger', 'negativeInteger',
    'unsignedInt', 'unsignedLong', 'unsignedShort', 'unsignedByte',
]);

function parseXml(xml: string): XmlDocument {
    // Tolera un BOM UTF-8 inicial (algunos editores lo añaden al XML ya firmado).
    return new DOMParser({ onError: onErrorStopParsing }).parseFromString(
        xml.replace(/^\uFEFF/, ''),
        'text/xml'
    );
}

function localChildren(el: XmlElement): XmlElement[] {
    const out: XmlElement[] = [];
    for (let c = el.firstChild as XmlNode | null; c; c = c.nextSibling) {
        if ((c as XmlElement).nodeType === 1) out.push(c as XmlElement);
    }
    return out;
}

function textOf(el: XmlElement): string {
    let out = '';
    for (let c = el.firstChild as XmlNode | null; c; c = c.nextSibling) {
        if (c.nodeType === 3 || c.nodeType === 4) out += c.nodeValue ?? '';
    }
    return out;
}

/* ------------------------------------------------------------------ */

function checkSimple(value: string, type: SimpleTypeDef, path: string, issues: ValidationIssue[]): void {
    const fail = (message: string) => issues.push({ path, message });

    if (type.enumerations?.length) {
        const numeric = type.base !== 'string' && NUMERIC_BASES.has(type.base);
        const matches = numeric && Number.isFinite(Number(value))
            ? type.enumerations.some((e) => Number(e) === Number(value))
            : type.enumerations.includes(value);
        if (!matches) {
            fail(
                `"${value}" no está en el catálogo de la DGII: ${type.enumerations.join(', ')}`
            );
        }
    }

    for (const pattern of type.patterns ?? []) {
        // En XSD el patrón se exige sobre TODA la cadena (implícitamente anclado).
        let re: RegExp;
        try {
            re = new RegExp(`^(?:${pattern})$`);
        } catch {
            fail(`patrón XSD inválido: ${pattern}`);
            continue;
        }
        if (!re.test(value)) {
            fail(`"${value}" no cumple el patrón de la DGII: /${pattern}/`);
        }
    }

    if (type.minLength !== undefined && value.length < type.minLength) {
        fail(`muy corto: ${value.length} caracteres, mínimo ${type.minLength}`);
    }
    if (type.maxLength !== undefined && value.length > type.maxLength) {
        fail(`muy largo: ${value.length} caracteres, máximo ${type.maxLength}`);
    }

    if (!NUMERIC_BASES.has(type.base)) return;

    const n = Number(value);
    if (!Number.isFinite(n)) {
        if (!INTEGER_BASES.has(type.base) || !/^[+-]?\d+$/.test(value)) {
            fail(`"${value}" no es un número válido (tipo ${type.base})`);
            return;
        }
    }

    const digitsPart = value.replace(/^[+-]/, '').replace('.', '');
    const integerDigits = value.replace(/^[+-]/, '').split('.')[0].length;
    const fractionDigits = value.includes('.') ? value.split('.')[1].length : 0;

    if (type.totalDigits !== undefined && integerDigits + fractionDigits > type.totalDigits) {
        fail(`${value} excede totalDigits=${type.totalDigits}`);
    }
    if (type.fractionDigits !== undefined && fractionDigits > type.fractionDigits) {
        fail(`${value} excede fractionDigits=${type.fractionDigits}`);
    }
    void digitsPart;

    if (type.minInclusive !== undefined && n < type.minInclusive) fail(`${value} < minInclusive=${type.minInclusive}`);
    if (type.maxInclusive !== undefined && n > type.maxInclusive) fail(`${value} > maxInclusive=${type.maxInclusive}`);
    if (type.minExclusive !== undefined && n <= type.minExclusive) fail(`${value} <= minExclusive=${type.minExclusive}`);
    if (type.maxExclusive !== undefined && n >= type.maxExclusive) fail(`${value} >= maxExclusive=${type.maxExclusive}`);
}

/* ------------------------------------------------------------------ */

function validateElement(
    el: XmlElement,
    def: SchemaNode,
    path: string,
    issues: ValidationIssue[],
    requireSignature: boolean
): void {
    const here = `${path}/${def.name}`;

    if (def.any) {
        // Slot de la firma digital: cualquier elemento es bienvenido y su
        // interior no forma parte del formato e-CF.
        return;
    }

    if (def.children) {
        const xmlKids = localChildren(el);
        let i = 0;
        for (const childDef of def.children) {
            const matched: XmlElement[] = [];
            if (childDef.any) {
                while (i < xmlKids.length) matched.push(xmlKids[i++]);
            } else {
                while (i < xmlKids.length && (xmlKids[i].localName ?? '') === childDef.name) {
                    matched.push(xmlKids[i++]);
                }
            }

            if (matched.length < childDef.minOccurs) {
                if (childDef.any && !requireSignature) {
                    // XML aún sin firmar: el XSD exige el slot, nosotros lo
                    // sabemos pendiente y lo validamos después de firmar.
                } else {
                    issues.push({
                        path: `${here}/${childDef.any ? 'Signature' : childDef.name}`,
                        message: childDef.any
                            ? 'falta la firma digital (es el único hijo obligatorio después de <FechaHoraFirma>)'
                            : `falta el tag obligatorio <${childDef.name}>`,
                    });
                }
            } else if (matched.length > childDef.maxOccurs) {
                issues.push({
                    path: `${here}/${childDef.name}`,
                    message: `aparece ${matched.length} veces, el XSD de la DGII admite ${childDef.maxOccurs}`,
                });
            }

            for (const kid of matched.slice(0, childDef.maxOccurs)) {
                validateElement(kid, childDef, here, issues, requireSignature);
            }
        }

        if (i < xmlKids.length) {
            issues.push({
                path: `${here}/${xmlKids[i].localName}`,
                message:
                    `tag <${xmlKids[i].localName}> fuera del orden que exige el XSD de la DGII ` +
                    `(va después de <${def.children[def.children.length - 1]?.name}>)`,
            });
        }
        return;
    }

    if (!def.simple) {
        issues.push({ path: here, message: 'el XSD no describe este tag' });
        return;
    }

    const value = textOf(el);
    if (value.length === 0) {
        issues.push({
            path: here,
            message:
                'tag vacío: la DGII rechaza los e-CF con tags sin valor ' +
                '(Descripción Técnica Emisores Electrónicos, "Restricciones de Contenido…")',
        });
        return;
    }
    checkSimple(value, def.simple, here, issues);
}

/* ------------------------------------------------------------------ */

function validateParsed(
    xml: string,
    parsed: ParsedSchema,
    requireSignature: boolean
): ValidationResult {
    const issues: ValidationIssue[] = [];

    let doc: XmlDocument;
    try {
        doc = parseXml(xml);
    } catch (err) {
        return { valid: false, issues: [{ path: '/', message: `XML mal formado: ${(err as Error).message}` }] };
    }

    const rootEl = doc.documentElement;
    if (!rootEl) {
        return { valid: false, issues: [{ path: '/', message: 'documento sin elemento raíz' }] };
    }

    if (rootEl.localName !== parsed.root.name) {
        issues.push({
            path: `/${rootEl.localName}`,
            message: `raíz incorrecta: se esperaba <${parsed.root.name}> (XSD ${parsed.entry.file})`,
        });
        return { valid: false, issues };
    }

    validateElement(rootEl, parsed.root, '', issues, requireSignature);
    return { valid: issues.length === 0, issues };
}

/* ---------------------------------------------------------------- API -- */

export interface ValidateOptions {
    /**
     * `true` (por omisión) exige la `<Signature>`: es como se envía el XML a la
     * DGII. Pásalo a `false` para revisar el XML recién construido, antes de
     * firmar.
     */
    requireSignature?: boolean;
}

/**
 * Valida un XML contra un XSD oficial de la DGII (nombre de archivo base:
 * `ecf-31`, `ecf-32`, `ecf-34`, `rfce-32`, `semilla`).
 */
export function validateAgainstSchema(
    xml: string,
    schemaName: SchemaName,
    options: ValidateOptions = {}
): ValidationResult {
    const requireSignature = options.requireSignature ?? true;
    return validateParsed(xml, getParsedSchema(schemaName), requireSignature);
}

export function validateEcf(
    xml: string,
    tipo: 31 | 32 | 34,
    options: ValidateOptions = {}
): ValidationResult {
    return validateAgainstSchema(xml, `ecf-${tipo}`, options);
}

export function validateRfce(xml: string, options: ValidateOptions = {}): ValidationResult {
    return validateAgainstSchema(xml, 'rfce-32', options);
}

export function validateSemilla(xml: string, options: ValidateOptions = {}): ValidationResult {
    return validateAgainstSchema(xml, 'semilla', options);
}

export function formatIssues(result: ValidationResult): string {
    return result.issues.map((i) => `  ${i.path}: ${i.message}`).join('\n');
}

/** Lanza con un mensaje legible si el XML no cumple el XSD oficial. */
export function assertValidEcf(xml: string, tipo: 31 | 32 | 34): void {
    const result = validateEcf(xml, tipo);
    if (!result.valid) {
        throw new Error(
            `El e-CF tipo ${tipo} no cumple el XSD oficial ${`ecf-${tipo}.xsd`}:\n${formatIssues(result)}`
        );
    }
}
