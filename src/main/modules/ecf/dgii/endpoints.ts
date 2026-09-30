/**
 * Endpoints oficiales de la DGII para facturación electrónica.
 *
 * Fuente: DGII — "Descripción Técnica Servicios DGII" (vigente desde el
 * 02-01-2026, fecha en que se segregó la antigua "Descripción Técnica de
 * Facturación Electrónica"), sección "Descripción de Servicios" → URL de cada
 * servicio. Hash y URL en `docs/fec/FUENTES.md`; reglas en
 * `docs/fec/REQUISITOS.md`.
 *
 * Ambientes:
 *   - `testecf` → pre-certificación
 *   - `certecf` → certificación
 *   - `ecf`     → producción
 */

export type Ambiente = 'testecf' | 'certecf' | 'ecf';

export const AMBIENTES: readonly Ambiente[] = ['testecf', 'certecf', 'ecf'];

/** Host de los servicios de e-CF (recepción, consulta, autenticación). */
export const HOST_ECF = 'https://ecf.dgii.gov.do';
/** Host de los servicios de Factura de Consumo < RD$250,000 (RFCE/timbre FC). */
export const HOST_FC = 'https://fc.dgii.gov.do';

/**
 * Servicios de autenticación (semilla → token).
 * "Descripción Técnica" → Autenticación → URLs del servicio.
 */
export const AUTENTICACION = {
    /** GET — devuelve el XML `<SemillaModel>` que hay que firmar. */
    semilla: (a: Ambiente) => `${HOST_ECF}/${a}/autenticacion/api/autenticacion/semilla`,
    /** POST multipart (`xml`) — devuelve `{ token, expira, expedido }`. */
    validarSemilla: (a: Ambiente) => `${HOST_ECF}/${a}/autenticacion/api/autenticacion/validarsemilla`,
} as const;

/**
 * Recepción de e-CF.
 *
 * "Las Facturas de Consumo Electrónica con un monto inferior a los
 *  RD$250,000.00, no serán recibidos por este servicio, se deberá remitir un
 *  resumen de este al servicio recepción de resumen factura de consumo e-CF."
 */
export const RECEPCION = {
    /** POST multipart (`xml`) — e-CF 31/34 y E32 ≥ RD$250,000. Devuelve `trackId`. */
    ecf: (a: Ambiente) => `${HOST_ECF}/${a}/recepcion/api/facturaselectronicas`,
    /** POST multipart (`xml`) — resumen (RFCE) de las E32 < RD$250,000. */
    rfce: (a: Ambiente) => `${HOST_FC}/${a}/recepcionfc/api/recepcion/ecf`,
} as const;

export const CONSULTAS = {
    /**
     * GET `?RNC_Emisor=&ENCF=&Cod_Seguridad_eCF=` — estado de un **RFCE**
     * (Factura de Consumo < RD$250,000). La DGII publica los tres ambientes.
     * Los nombres de los parámetros son literalmente los del ejemplo CURL.
     */
    rfce: (a: Ambiente) => `${HOST_FC}/${a}/consultarfce/api/Consultas/Consulta`,
    /** GET `?trackid=` — resultado de la validación de un e-CF enviado.
     * (Servicio "Consulta Resultado".)
     */
    porTrackId: (a: Ambiente) => `${HOST_ECF}/${a}/consultaresultado/api/consultas/estado`,
    /**
     * GET `?rncemisor=&ncfelectronico=&rnccomprador=&codigoseguridad=`
     * — estado de un e-CF concreto. La DGII solo publica `testecf` y `ecf`
     * para este servicio (no `certecf`).
     */
    porNcf: (a: Ambiente) => `${HOST_ECF}/${a}/consultaestado/api/consultas/estado`,
    /** GET `?rncemisor=&encf=` — trackId de un e-NCF ya emitido. */
    trackIds: (a: Ambiente) => `${HOST_ECF}/${a}/consultatrackids/api/trackids/consulta`,
} as const;

/**
 * Timbre (consulta del QR de la Representación Impresa).
 *
 * "Tener en cuenta a la hora de realizar la representación impresa de los e-CF,
 *  que existen dos consultas timbre con variación de uso para los tipos 32."
 *   — Descripción Técnica, Recomendaciones #5
 */
export const TIMBRE = {
    /** E31/E34 y E32 ≥ RD$250,000. */
    general: (a: Ambiente) => `${HOST_ECF}/${a}/consultatimbre`,
    /** E32 < RD$250,000. */
    consumo: (a: Ambiente) => `${HOST_FC}/${a}/consultatimbrefc`,
} as const;

/**
 * Disponibilidad de los servicios (sin autenticación).
 * "Descripción Técnica" → Consulta Estatus Servicios.
 */
export const ESTATUS_SERVICIOS = {
    obtener: 'https://statusecf.dgii.gov.do/api/estatusservicios/obtenerestatus',
    ventanasMantenimiento: 'https://statusecf.dgii.gov.do/api/estatusservicios/obtenerventanasmantenimiento',
} as const;

/**
 * Nombre de archivo que exige la DGII para cada XML enviado.
 *
 * "Formato e-CF           RNCEmisor+e-NCF     101672919E3100000001.xml"
 *  — Descripción Técnica, "Formato de Nombre de los Archivos XML"
 */
export function nombreArchivoXml(rncEmisor: string, encf: string): string {
    return `${rncEmisor}${encf}.xml`;
}

/** Formato `dd-MM-yyyy` que exige el XSD (`FechaValidationType`). */
export function formatoFecha(fecha: Date): string {
    const dd = String(fecha.getDate()).padStart(2, '0');
    const mm = String(fecha.getMonth() + 1).padStart(2, '0');
    const yyyy = fecha.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
}

/**
 * Formato `dd-MM-yyyy HH:mm:ss` que exige el XSD (`DateTimeValidationType`,
 * máx. 19 caracteres) para `<FechaHoraFirma>`.
 *
 * La zona horaria NO es local: la DGII la fija.
 *
 *   "Fecha y hora de la firma digital del e-CF < FechaHoraFirma> — Fecha y
 *    hora en formato dd-MM-AAAA HH:mm:ss; **Zona horaria GMT -4**."
 *    — Formato de Comprobante Fiscal Electrónico, sección G "FECHA Y HORA DE
 *      LA FIRMA DIGITAL", `docs/fec/REQUISITOS.md` §4.16.
 */
export function formatoFechaHora(fecha: Date): string {
    // GMT-4 = UTC-4: al desplazar la marca de tiempo leemos los campos UTC.
    const gmt4 = new Date(fecha.getTime() - 4 * 3_600_000);
    const dd = String(gmt4.getUTCDate()).padStart(2, "0");
    const mm = String(gmt4.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = gmt4.getUTCFullYear();
    const hh = String(gmt4.getUTCHours()).padStart(2, "0");
    const mi = String(gmt4.getUTCMinutes()).padStart(2, "0");
    const ss = String(gmt4.getUTCSeconds()).padStart(2, "0");
    return `${dd}-${mm}-${yyyy} ${hh}:${mi}:${ss}`;
}
