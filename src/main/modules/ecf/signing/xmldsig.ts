import { DOMParser, type Element } from '@xmldom/xmldom';
import { SignedXml } from 'xml-crypto';
import type { CertificadoDigital } from './p12';

/**
 * Firma digital XMLDSig de los e-CF.
 *
 * Todos los algoritmos y la estructura de la firma están fijados por la DGII:
 *
 * - "El protocolo de firmado a utilizar es SHA-256." (Descripción Técnica
 *   Emisores Electrónicos, "Firmado de XML").
 * - "Se firma mediante el algoritmo SHA-256." (Preguntas Técnicas e-CF, #7)
 * - "…la función criptográfica SHA256 para la firma, es obligatorio usar este
 *   tipo de función al firmar el XML." (Firmado de e-CF.pdf)
 *
 * La forma exacta de `<Signature>` reproducida aquí es la de los cinco
 * ejemplos oficiales de la DGII (.NET C#, VB.NET, TypeScript, Java, PHP):
 *
 *   <Signature xmlns="http://www.w3.org/2000/09/xmldsig#">
 *     <SignedInfo>
 *       <CanonicalizationMethod Algorithm="…REC-xml-c14n-20010315"/>
 *       <SignatureMethod   Algorithm="…xmldsig-more#rsa-sha256"/>
 *       <Reference URI="">
 *         <Transforms>
 *           <Transform Algorithm="…xmldsig#enveloped-signature"/>
 *         </Transforms>
 *         <DigestMethod Algorithm="…xmlenc#sha256"/>
 *         <DigestValue>…</DigestValue>
 *       </Reference>
 *     </SignedInfo>
 *     <SignatureValue>…</SignatureValue>
 *     <KeyInfo><X509Data><X509Certificate>…</X509Certificate></X509Data></KeyInfo>
 *   </Signature>
 *
 * Notas de trazabilidad:
 * - El ejemplo oficial de la DGII en TypeScript ("Firmado de e-CF.pdf") está
 *   TRUNCADO: usa `this.attrCompare`, `this.nsCompare` e `this.includeComments`
 *   sin definirlos jamás, así que no puede ejecutarse tal cual. Aquí se usan en
 *   su lugar las implementaciones de referencia de las recomendaciones W3C que
 *   la propia DGII cita (`CanonicalizationMethod = REC-xml-c14n-20010315`),
 *   servidas por `xml-crypto`.
 * - Los cinco ejemplos oficiales incluyen ÚNICAMENTE la transformación
 *   `enveloped-signature` en `Reference/Transforms` (sin c14n explícito); así
 *   se emite aquí, y el digest se calcula sobre el documento ya canonicalizado
 *   con C14N inclusivo, tal como lo hace la DGII.
 * - La `<Signature>` ocupa el único slot `xs:any minOccurs="1" maxOccurs="1"`
 *   que el XSD deja después de `<FechaHoraFirma>`.
 */

export const ALGORITMOS_DSIG = {
    /** Canonicalización de SignedInfo (y del documento para el digest). */
    canonicalizacion: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
    /** Firma digital: RSA con SHA-256. */
    firma: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    /** Única transformación de Reference en los ejemplos oficiales. */
    transformacion: 'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
    /** Digest del documento: SHA-256. */
    digest: 'http://www.w3.org/2001/04/xmlenc#sha256',
    /** Espacio de nombres del elemento <Signature>. */
    espacioNombres: 'http://www.w3.org/2000/09/xmldsig#',
} as const;

/**
 * Firma un XML (e-CF o semilla) y devuelve el XML firmado.
 *
 * La DGII exige firmar **sin preservar espacios** (`preserveWhitespace=false`)
 * y no alterar el XML después de firmarlo: por eso el builder no emite
 * sangrías ni saltos de línea, y este módulo solo añade la `<Signature>`.
 */
export function firmarXml(xml: string, cert: CertificadoDigital): string {
    if (/<Signature[\s>]/i.test(xml)) {
        throw new Error('El XML ya contiene una <Signature>: firmar dos veces lo invalidaría.');
    }

    const sig = new SignedXml({
        privateKey: cert.privateKeyPem,
        publicCert: cert.certificatePem,
        signatureAlgorithm: ALGORITMOS_DSIG.firma,
        canonicalizationAlgorithm: ALGORITMOS_DSIG.canonicalizacion,
    });

    // `isEmptyUri: true` ⇒ `Reference URI=""` (misma referencia de documento)
    // y, muy importante, NO se le inyecta un atributo Id al elemento ECF.
    sig.addReference({
        xpath: '/*',
        transforms: [ALGORITMOS_DSIG.transformacion],
        digestAlgorithm: ALGORITMOS_DSIG.digest,
        isEmptyUri: true,
    });

    // `location` por omisión: se añade como ÚLTIMO hijo de la raíz, que es
    // justo donde el XSD de la DGII deja el slot de la firma.
    sig.computeSignature(xml);
    return sig.getSignedXml();
}

function buscarFirma(xml: string): Element | null {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const root = doc.documentElement;
    if (!root) return null;
    for (let c = root.firstChild; c; c = c.nextSibling) {
        const node = c as Element;
        if (node.nodeType === 1 && node.localName === 'Signature') return node;
    }
    return null;
}

/** Extrae el `<SignatureValue>` (base64) de un XML firmado. */
export function extraerSignatureValue(xml: string): string {
    const m = xml.match(/<SignatureValue[^>]*>([\s\S]*?)<\/SignatureValue>/);
    if (!m) throw new Error('El XML no contiene <SignatureValue>: no está firmado.');
    return m[1].replace(/\s+/g, '');
}

/** Extrae el `<DigestValue>` (base64, SHA-256 del documento). */
export function extraerDigestValue(xml: string): string {
    const m = xml.match(/<DigestValue[^>]*>([\s\S]*?)<\/DigestValue>/);
    if (!m) throw new Error('El XML no contiene <DigestValue>: no está firmado.');
    return m[1].replace(/\s+/g, '');
}

export interface ResultadoVerificacion {
    ok: boolean;
    error?: string;
}

/**
 * Verifica la firma de un e-CF (digest del documento + firma de SignedInfo).
 *
 * Es una verificación local de integridad: la autoridad final es la DGII, que
 * valida contra su propio almacén de confianza.
 */
export function verificarFirma(xml: string): ResultadoVerificacion {
    try {
        const firma = buscarFirma(xml);
        if (!firma) return { ok: false, error: 'El XML no contiene <Signature>.' };

        // OJO: xml-crypto v6 deja `getCertFromKeyInfo` en `noop` por omisión
        // (no confía en el certificado que viaja dentro del propio XML). Aquí
        // se activa a propósito: esta verificación comprueba INTEGRIDAD (que el
        // XML no cambió tras firmarse). La confianza en el certificado la
        // establece la DGII contra su propio almacén de confianza.
        const sig = new SignedXml({
            getCertFromKeyInfo: SignedXml.getCertFromKeyInfo,
        });
        sig.loadSignature(firma as unknown as Node);
        const ok = sig.checkSignature(xml);
        return ok
            ? { ok: true }
            : { ok: false, error: 'La firma no corresponde al contenido del documento.' };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}

/** ¿La estructura de la firma usa los algoritmos que exige la DGII? */
export function firmaUsaAlgoritmosDgii(xml: string): { ok: boolean; detalles: Record<string, string> } {
    const grabar = (re: RegExp): string => (xml.match(re)?.[1] ?? '').trim();
    const detalles = {
        canonicalizacion: grabar(/<CanonicalizationMethod[^>]*Algorithm="([^"]+)"/),
        firma: grabar(/<SignatureMethod[^>]*Algorithm="([^"]+)"/),
        digest: grabar(/<DigestMethod[^>]*Algorithm="([^"]+)"/),
        transformacion: grabar(/<Transform[^>]*Algorithm="([^"]+)"/),
        uri: graberUri(xml),
    };
    const ok =
        detalles.canonicalizacion === ALGORITMOS_DSIG.canonicalizacion &&
        detalles.firma === ALGORITMOS_DSIG.firma &&
        detalles.digest === ALGORITMOS_DSIG.digest &&
        detalles.transformacion === ALGORITMOS_DSIG.transformacion &&
        detalles.uri === '';
    return { ok, detalles };
}

function graberUri(xml: string): string {
    const m = xml.match(/<Reference[^>]*URI="([^"]*)"/);
    return m ? m[1] : '(sin URI)';
}
