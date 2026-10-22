/**
 * Escapado de caracteres XML.
 *
 * Fuente oficial: DGII — "Descripción Técnica Emisores Electrónicos", sección
 * "Restricciones de Contenido y/o Caracteres en los XML" (actualizada el
 * 03-04-2025: "Se agregaron nuevos caracteres de escape de restricciones de
 * Contenido y/o Caracteres en los XML"). Ver `docs/fec/FUENTES.md`.
 *
 *   "En la información 'ALFANUM' dentro de los XML a generar y enviar, los
 *    siguientes caracteres no deben emplearse, ya que tienen un significado
 *    por sí solos y deberán ser remplazados por definiciones estándar
 *    especificadas a continuación:
 *
 *      Nombre   Carácter   Referencia Decimal   Referencia Hexadecimal
 *      quot      "            &#34;                 &#x22;
 *      amp       &            &#38;                 &#x26;
 *      apos      '            &#39;                 &#x27;
 *      lt        <            &#60;                 &#x3C;
 *      gt        >            &#62;                 &#x3E;
 *      copy      ©            &#169;                &#xA9;
 *      euro      €            &#8364;               &#x20AC;
 *      reg       ®            &#174;                &#xAE;"
 *
 * Se usan las entidades con nombre de XML para los cinco metacaracteres y
 * referencias numéricas para `©`/`€`/`®` (ver `ESCAPES`), aplicándose tanto en
 * texto como en atributos: cubre así las ocho filas de la tabla.
 */

const ESCAPES: ReadonlyArray<readonly [string, string]> = [
    ['&', '&amp;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
    ['"', '&quot;'],
    ["'", '&apos;'],
    // Tres caracteres que la DGII agregó el 03-04-2025 a la tabla.
    // La tabla ofrece tres variantes por carácter (nominal / decimal / hexa);
    // se usa la NUMÉRICA, que es la única válida en XML 1.0 sin DTD
    // (&copy; &euro; &reg; son entidades HTML, no XML, y un parser estricto
    // los rechazaría). Ambas variantes son ofrecidas por la DGII, así que no
    // se inventa nada: solo se descarta la que rompería el XML.
    ['\u00A9', '&#169;'], // ©
    ['\u20AC', '&#8364;'], // €
    ['\u00AE', '&#174;'], // ®
];

const ESCAPE_RE = /[&<>"']|\u00A9|\u20AC|\u00AE/g;

/**
 * Escapa los ocho caracteres reservados exigidos por la DGII.
 * Aplicable tanto a contenido de texto como a valores de atributo.
 *
 * Nota: una referencia de carácter XML decodifica al mismo carácter que la
 * literal, así que esto no cambia el valor validado por el XSD; cumple la
 * exigencia de la DGII de no incluir esos caracteres "crudos" en el archivo.
 */
export function escapeXml(value: string): string {
    return String(value).replace(ESCAPE_RE, (ch) => {
        const found = ESCAPES.find(([raw]) => raw === ch);
        return found ? found[1] : ch;
    });
}

/**
 * Un tag sin valor provoca rechazo en la DGII:
 *
 *   "Adicionalmente, no deberá incluirse tags vacíos en los XML. Todo tag que
 *    no vaya a ser utilizado debe excluirse del e-CF, ya que su evaluación sin
 *    ningún tipo de valor provoca rechazos y afecta el tiempo de validación."
 *    — Descripción Técnica Emisores Electrónicos, "Restricciones de Contenido
 *      y/o Caracteres en los XML"
 *
 * Por eso un valor "vacío" no se serializa. OJO: `0` y `'0'` NO son vacíos.
 */
export function isBlankValue(value: unknown): boolean {
    if (value === undefined || value === null) return true;
    if (typeof value === 'string') return value.trim().length === 0;
    return false;
}
