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
     * GET `?trackid=` — resultado de la validación de un e-CF enviado.
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
 * OJO: usa la zona horaria LOCAL. La DGII no fija zona horaria para este tag;
 * ver `docs/fec/REQUISITOS.md` (pendiente de confirmar si debe emitirse en
 * hora local de RD).
 */
export function formatoFechaHora(fecha: Date): string {
    const hh = String(fecha.getHours()).padStart(2, '0');
    const mi = String(fecha.getMinutes()).padStart(2, '0');
    const ss = String(fecha.getSeconds()).padStart(2, '0');
    return `${formatoFecha(fecha)} ${hh}:${mi}:${ss}`;
}
