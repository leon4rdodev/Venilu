/**
 * Cliente HTTP de los servicios web de la DGII.
 *
 * Fuente: DGII — "Descripción Técnica Servicios DGII" (vigente 02-01-2026),
 * secciones *Autenticación* y *Consulta Estatus Servicios*. Reglas citadas en
 * `docs/fec/REQUISITOS.md` (§4.4), hashes de las fuentes en `docs/fec/FUENTES.md`.
 *
 * Flujo de autenticación (lo único que se implementa aquí):
 *
 *   1. `GET  …/autenticacion/api/autenticacion/semilla`   → `<SemillaModel>`.
 *   2. Se firma con el certificado del PSFE y se valida contra
 *      `Semilla v.1.0.xsd` (SHA-256 en FUENTES.md) ANTES de enviarlo.
 *   3. `POST …/autenticacion/api/autenticacion/validarsemilla`
 *      multipart (`xml`) → `{ token, expira, expedido }` — token JWT de 1 hora.
 *   4. Después: `Authorization: bearer <token>`.
 *
 * La recepción y la consulta de estado NO van por aquí todavía: se añaden con
 * el ciclo de emisión/consulta (Fase siguiente).
 */

import { AUTENTICACION, ESTATUS_SERVICIOS, Ambiente } from './endpoints';
import { firmarXml } from '../signing/xmldsig';
import { validateSemilla, formatIssues } from '../xml/xsd-validator';
import type { CertificadoDigital } from '../signing/p12';

/** Respuesta documentada del servicio de validación de semilla. */
export interface TokenDgii {
    token: string;
    expira?: string;
    expedido?: string;
}

interface EntradaCache {
    ambiente: Ambiente;
    token: string;
    venceEn: number;
}

/** Token en memoria: 1 h por el momento → renovamos con 5 min de holgura. */
let cache: EntradaCache | null = null;

/** Vida del token (1 h) menos el margen de seguridad antes de renovarlo. */
const MARGEN_MS = 5 * 60 * 1000;

async function get(url: string, timeoutMs = 30_000): Promise<Response> {
    return fetch(url, { method: 'GET', signal: AbortSignal.timeout(timeoutMs) });
}

/** Error accionable, en español, con el detalle de la DGII si lo hay. */
function fallo(servicio: string, status: number, cuerpo: string): Error {
    const detalle = cuerpo.slice(0, 400).replace(/\s+/g, ' ').trim();
    return new Error(
        `La DGII respondió ${status} en ${servicio}${detalle ? `: ${detalle}` : '.'}`,
    );
}

// ── Autenticación ───────────────────────────────────────────────────────────

/**
 * Pide la semilla, la firma con el certificado del PSFE y la canjea por un
 * token. Devuelve el token vigente reutilizando el caché mientras no venza.
 */
export async function autenticar(
    ambiente: Ambiente,
    cert: CertificadoDigital,
    forzar = false,
): Promise<string> {
    const ahora = Date.now();
    if (!forzar && cache && cache.ambiente === ambiente && cache.venceEn > ahora) {
        return cache.token;
    }

    const urlSemilla = AUTENTICACION.semilla(ambiente);
    const rSemilla = await get(urlSemilla);
    if (!rSemilla.ok) throw fallo('obtención de la semilla', rSemilla.status, await rSemilla.text());

    const semilla = await rSemilla.text();
    const firmada = firmarXml(semilla, cert);

    // Nunca enviar una semilla que no valida contra el XSD oficial.
    const check = validateSemilla(firmada, { requireSignature: true });
    if (!check.valid) {
        throw new Error(`La semilla firmada no valida contra Semilla v.1.0.xsd: ${formatIssues(check)}`);
    }

    const form = new FormData();
    form.append('xml', new Blob([firmada], { type: 'text/xml' }), 'semilla.xml');

    const urlValidar = AUTENTICACION.validarSemilla(ambiente);
    const rToken = await fetch(urlValidar, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(30_000),
    });
    const texto = await rToken.text();
    if (!rToken.ok) throw fallo('validación de la semilla', rToken.status, texto);

    let datos: TokenDgii;
    try {
        datos = JSON.parse(texto) as TokenDgii;
    } catch {
        throw new Error(`La DGII devolvió una respuesta que no es JSON: ${texto.slice(0, 200)}`);
    }
    if (!datos.token) throw new Error('La DGII no devolvió token en la validación de la semilla.');

    cache = { ambiente, token: datos.token, venceEn: Date.now() + 60 * 60 * 1000 - MARGEN_MS };
    return datos.token;
}

/** Borra el token en memoria (al cambiar de certificado o de ambiente). */
export function limpiarToken(): void {
    cache = null;
}

// ── Consultas sin autenticación ─────────────────────────────────────────────

export interface ResultadoRed {
    ok: boolean;
    status: number;
    /** Cuerpo de la respuesta tal cual, para mostrarlo en Ajustes → Fiscal. */
    detalle: string;
    /**
     * true cuando la DGII responde **401**: el servicio exige una credencial
     * (API key) que esta app no recibe. NO significa que los servicios e-CF
     * estén caídos — para eso está `probarAmbiente()`.
     */
    credencialRequerida: boolean;
}

export type EstatusServicio = ResultadoRed;

/**
 * Comprueba que el ambiente elegido responde de verdad ante la DGII.
 *
 * Usa el **GET de la semilla**, que es el primer paso del flujo de autenticación
 * documentado en *Descripción Técnica Servicios DGII* → Autenticación (entrada
 * "N/A") y **no exige token ni API key**. Verificado el 2026-09-26: los tres
 * ambientes (`testecf`, `certecf`, `ecf`) devuelven `HTTP 200` con `<SemillaModel>`.
 *
 * Esta es la comprobación real de conexión: cubre DNS, TLS, ruta y ambiente.
 */
export async function probarAmbiente(ambiente: Ambiente): Promise<ResultadoRed> {
    const vacio = (status: number, detalle: string): ResultadoRed => ({
        ok: false,
        status,
        detalle,
        credencialRequerida: status === 401,
    });
    try {
        const r = await get(AUTENTICACION.semilla(ambiente), 15_000);
        const cuerpo = await r.text();
        if (!r.ok) {
            return vacio(
                r.status,
                `El ambiente ${ambiente} respondió HTTP ${r.status}${
                    cuerpo ? `: ${cuerpo.slice(0, 300).replace(/\s+/g, ' ').trim()}` : ' sin cuerpo.'
                }`,
            );
        }
        if (!/<SemillaModel/i.test(cuerpo)) {
            return vacio(
                r.status,
                `El ambiente ${ambiente} respondió HTTP ${r.status}, pero la respuesta no es una semilla válida: ${cuerpo
                    .slice(0, 300)
                    .replace(/\s+/g, ' ')
                    .trim()}`,
            );
        }
        return {
            ok: true,
            status: r.status,
            detalle: `Ambiente ${ambiente} accesible: HTTP ${r.status} con semilla válida.`,
            credencialRequerida: false,
        };
    } catch (err) {
        return vacio(0, err instanceof Error ? err.message : `Sin respuesta del ambiente ${ambiente}.`);
    }
}

/**
 * Lista de estatus de los servicios de la DGII.
 *
 * IMPORTANTE: el servicio **no está documentado** en *Descripción Técnica
 * Servicios DGII* (su índice no lo incluye) y en ejecución responde siempre
 * `HTTP 401` con cuerpo vacío, con o sin encabezado de autorización
 * (verificado el 2026-09-26). Se conserva la consulta, pero **no decide** si
 * hay conexión: para eso se usa `probarAmbiente()`.
 */
export async function estatusServicios(): Promise<EstatusServicio> {
    try {
        const r = await get(ESTATUS_SERVICIOS.obtener, 15_000);
        const cuerpo = (await r.text()).slice(0, 1000);
        const credencial = r.status === 401;
        return {
            ok: r.ok,
            status: r.status,
            detalle: credencial
                ? 'HTTP 401 (credencial requerida). Este servicio exige una API key entregada por la DGII y no está documentado en la Descripción Técnica vigente; no invalida la conexión.'
                : cuerpo || `HTTP ${r.status}.`,
            credencialRequerida: credencial,
        };
    } catch (err) {
        return {
            ok: false,
            status: 0,
            detalle: err instanceof Error ? err.message : 'Sin respuesta de la DGII',
            credencialRequerida: false,
        };
    }
}
