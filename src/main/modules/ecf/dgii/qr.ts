import { TIMBRE, type Ambiente } from './endpoints';

/**
 * URL del timbre (la que codifica el QR de la Representación Impresa).
 *
 * Fuente: DGII — "Descripción Técnica Servicios DGII", servicios "Consulta
 * timbre (QR)" y "Consulta timbre FC (QR)", y "Descripción Técnica Emisores
 * Electrónicos" → apartado "Restricciones de Contenido y/o Caracteres en los
 * XML" → caracteres reservados del código de seguridad.
 * Ver `docs/fec/FUENTES.md` y `docs/fec/REQUISITOS.md` §3.
 *
 * Dos variantes, según la propia DGII (Recomendaciones #5):
 *
 *   • E31/E34 y E32 ≥ RD$250,000 → `…/consultatimbre`
 *   • E32 < RD$250,000           → `fc.dgii.gov.do/…/consultatimbrefc`
 *
 * Los ejemplos oficiales se reproducen tal cual en las pruebas
 * (`qr.test.ts`), URL por URL.
 */

/** Límite para elegir entre timbre general y timbre de Factura de Consumo. */
export const UMBRAL_CONSUMO = 250_000;

/**
 * Caracteres que la DGII permite dejar tal cual en la URL de timbre:
 * letras, dígitos y `-` `.` `_` `~` `:`.
 *
 * Se corresponden con los ejemplos oficiales (`montototal=6225.09`,
 * `fechaemision=10-10-2020`, `fechafirma=10-10-2020%2009:00:00`).
 * Todo lo demás se percent-encoding, incluyendo los caracteres reservados que
 * la DGII lista expresamente para el código de seguridad.
 */
const PERMITIDOS_SIN_CODIFICAR = /[A-Za-z0-9\-._~:]/;

function percentUtf8(ch: string): string {
    return Array.from(Buffer.from(ch, 'utf8'))
        .map((b) => `%${b.toString(16).toUpperCase().padStart(2, '0')}`)
        .join('');
}

/**
 * Percent-encoding de un valor de parámetro.
 *
 * Cubre los caracteres de la tabla oficial de la DGII (`Espacio %20`, `! %21`,
 * `# %23`, `$ %24`, `& %26`, `' %27`, `( %28`, `) %29`, `* %2A`, `+ %2B`,
 * `, %2C`, `/ %2F`, `: %3A`*, `; %3B`, `= %3D`, `? %3F`, `@ %40`, `[ %5B`,
 * `] %5D`, `" %22`, `< %3C`, `> %3E`, `\ %5C`, `^ %5E`, `` ` %60 ``) además de
 * `%` y cualquier byte no ASCII.
 *
 * \* `:` se deja literal porque así aparece en el ejemplo oficial de la DGII
 * (`fechafirma=10-10-2020%2009:00:00`); `-`, `.` y `_` igual (`6225.09`).
 * Nota: la tabla del DGII los lista como `%2D/%2E/%5F`, pero el ejemplo de la
 * misma guía los deja crudos; se sigue el ejemplo, que es comprobable.
 */
export function codificarParametro(valor: string): string {
    return Array.from(String(valor))
        .map((ch) => (PERMITIDOS_SIN_CODIFICAR.test(ch) ? ch : percentUtf8(ch)))
        .join('');
}

function armarUrl(base: string, params: Array<[string, string]>): string {
    const query = params
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${k}=${codificarParametro(v)}`)
        .join('&');
    return `${base}?${query}`;
}

/** Normaliza el monto: número → 2 decimales; texto → tal cual. */
function monto(v: string | number): string {
    return typeof v === 'number' ? v.toFixed(2) : String(v);
}

export interface TimbreEcfInput {
    ambiente: Ambiente;
    rncEmisor: string;
    /** Puede faltar (p. ej. E32 ≥ umbral a consumidor final). */
    rncComprador?: string | null;
    encf: string;
    /** `dd-MM-yyyy`, igual que `<FechaEmision>`. */
    fechaEmision: string;
    montoTotal: string | number;
    /** `dd-MM-yyyy HH:mm:ss`, igual que `<FechaHoraFirma>`. */
    fechaFirma: string;
    codigoSeguridad: string;
}

/**
 * Timbre general (E31, E34 y E32 ≥ RD$250,000).
 *
 * Orden de parámetros idéntico al ejemplo oficial:
 * `rncemisor`, `rnccomprador`, `encf`, `fechaemision`, `montototal`,
 * `fechafirma`, `codigoseguridad`.
 */
export function urlTimbreEcf(i: TimbreEcfInput): string {
    const params: Array<[string, string]> = [
        ['rncemisor', i.rncEmisor],
        ['encf', i.encf],
        ['fechaemision', i.fechaEmision],
        ['montototal', monto(i.montoTotal)],
        ['fechafirma', i.fechaFirma],
        ['codigoseguridad', i.codigoSeguridad],
    ];
    // `rnccomprador` va en segunda posición (como en el ejemplo oficial) solo
    // cuando el comprador tiene RNC.
    if (i.rncComprador) params.splice(1, 0, ['rnccomprador', i.rncComprador]);
    return armarUrl(TIMBRE.general(i.ambiente), params);
}

export interface TimbreConsumoInput {
    ambiente: Ambiente;
    rncEmisor: string;
    encf: string;
    montoTotal: string | number;
    codigoSeguridad: string;
}

/**
 * Timbre de Factura de Consumo < RD$250,000 (RFCE).
 *
 * Orden idéntico al ejemplo oficial: `rncemisor`, `encf`, `montototal`,
 * `codigoseguridad`.
 */
export function urlTimbreConsumo(i: TimbreConsumoInput): string {
    return armarUrl(TIMBRE.consumo(i.ambiente), [
        ['rncemisor', i.rncEmisor],
        ['encf', i.encf],
        ['montototal', monto(i.montoTotal)],
        ['codigoseguridad', i.codigoSeguridad],
    ]);
}

/**
 * Elige el timbre según el tipo y el monto:
 * "existen dos consultas timbre con variación de uso para los tipos 32".
 */
export function urlTimbrePara(
    tipo: 31 | 32 | 34,
    montoTotal: string | number,
    i: Omit<TimbreEcfInput, 'montoTotal'> & { ambiente: Ambiente }
): string {
    const esConsumo = tipo === 32 && Number(montoTotal) < UMBRAL_CONSUMO;
    if (esConsumo) {
        return urlTimbreConsumo({
            ambiente: i.ambiente,
            rncEmisor: i.rncEmisor,
            encf: i.encf,
            montoTotal,
            codigoSeguridad: i.codigoSeguridad,
        });
    }
    return urlTimbreEcf({ ...i, montoTotal });
}
