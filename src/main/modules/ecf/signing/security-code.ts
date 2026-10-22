import { createHash } from 'node:crypto';
import { extraerSignatureValue } from './xmldsig';

/**
 * Código de seguridad de la Representación Impresa (lo que va impreso bajo el
 * QR y viaja dentro del enlace del timbre).
 *
 * Definición oficial, idéntica en TRES documentos de la DGII:
 *
 *   "Código de Seguridad: corresponde a los primeros seis (6) dígitos del hash
 *    generado en el SignatureValue de la firma digital del e-CF."
 *
 *   - Instructivo Facturador Gratuito de FE, glosario.
 *   - Informe Técnico e-CF v1.0, 18.2.3.
 *   - Preguntas Técnicas e-CF, #15 y #16.
 *
 * La DGII jamás publica el algoritmo de ese "hash" ni su codificación. Las
 * fuentes disponibles permiten establecer estas dos cosas SÍ:
 *
 *   1. Miden SEIS caracteres, no seis dígitos numéricos. El propio XSD/Formato
 *      RFCE lo dice: campo 31 "Código Seguridad Factura de Consumo DOP$<250 M"
 *      → Largo 6, Tipo ALFA NUM. Y los ejemplos oficiales son `dcp79q` y
 *      `uabnyh` (mezcla de letras y números).
 *   2. Si el código contuviera caracteres reservados, la DGII obliga a
 *      percent-encoding en la URL (Restricciones de Contenido…: "deberán ser
 *      reemplazados en esta por su representación hexadecimal").
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PENDIENTE DE CONFIRMAR CON LA DGII (bloque `confirmacion-pendiente`).
 *
 * Hay DOS lecturas posibles de "los primeros 6 dígitos del hash generado en el
 * SignatureValue":
 *
 *   A) `SignatureValue.slice(0, 6)` — los 6 primeros caracteres del propio
 *      SignatureValue en base64 (la lectura literal de "…el hash generado en
 *      el SignatureValue": el hash va inserto en ese tag). Es la que implementa
 *      la librería de referencia de la comunidad (`dgii-ecf`,
 *      `getCodeSixDigitfromSignature`).
 *
 *   B) `hash(SignatureValue).slice(0, 6)` — aplicar un hash AL SignatureValue
 *      y quedarse con 6 caracteres. Exige además adivinar el algoritmo (¿MD5?,
 *      ¿SHA-1?, ¿SHA-256?) y la codificación (¿hex?, ¿base64?), que la DGII no
 *      publica.
 *
 * Se implementa la opción A por omisión porque es la única totalmente
 * determinada por la documentación oficial. **Cómo confirmarla en
 * pre-certificación (CertECF), con un solo comprobante:**
 *
 *   1. Emitir un E32 < RD$250,000 y leer su QR.
 *   2. Consultar el timbre con la opción A
 *      (`/consultatimbrefc?…&codigoseguridad=<A>`) y anotar la respuesta.
 *   3. Repetir con la opción B. La que devuelve "Aceptado" es la correcta.
 *
 * Mientras tanto, la estrategia es un parámetro explícito para poder
 * cambiarla en un solo lugar sin tocar el resto del sistema.
 */

export type EstrategiaCodigoSeguridad =
    /** Opción A: primeros 6 caracteres del `<SignatureValue>`. */
    | 'signature-value'
    /** Opción B: primeros 6 caracteres del SHA-256 (base64) del SignatureValue. */
    | 'sha256-base64'
    /** Opción B: primeros 6 caracteres del SHA-1 (base64) del SignatureValue. */
    | 'sha1-base64'
    /** Opción B: primeros 6 caracteres del MD5 (base64) del SignatureValue. */
    | 'md5-base64'
    /** Opción B: primeros 6 caracteres del MD5 (hex) del SignatureValue. */
    | 'md5-hex';

/**
 * Estrategia por omisión: opción A (ver comentario superior).
 * Se cambiará aquí cuando CertECF lo confirme.
 */
export const ESTRATEGIA_CODIGO_SEGURIDAD: EstrategiaCodigoSeguridad = 'signature-value';

const LONGITUD = 6;

/**
 * Calcula el código de seguridad de un e-CF **firmado**.
 *
 * @param xmlFirmado XML con `<SignatureValue>`.
 * @param estrategia por omisión {@link ESTRATEGIA_CODIGO_SEGURIDAD}.
 */
export function codigoSeguridad(
    xmlFirmado: string,
    estrategia: EstrategiaCodigoSeguridad = ESTRATEGIA_CODIGO_SEGURIDAD
): string {
    const signatureValue = extraerSignatureValue(xmlFirmado);

    if (estrategia === 'signature-value') {
        return signatureValue.slice(0, LONGITUD);
    }

    const algoritmo =
        estrategia === 'sha256-base64'
            ? 'sha256'
            : estrategia === 'sha1-base64'
                ? 'sha1'
                : 'md5';
    const hash = createHash(algoritmo).update(signatureValue, 'utf8');

    if (estrategia === 'md5-hex') return hash.digest('hex').slice(0, LONGITUD);
    return hash.digest('base64').slice(0, LONGITUD);
}
