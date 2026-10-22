import { In, Not } from "typeorm";

import { AppDataSource } from "@main/config/data-source";
import { NcfSequence } from "@main/modules/fiscal/entities/ncf-sequence.entity";
import { formatNcf, type NcfType } from "@main/modules/fiscal/services/fiscal.service";

import { EcfAnulacion } from "../entities/ecf-anulacion.entity";
import { buildAnecfXml } from "../xml/build-anecf";
import { validateAnecf, formatIssues } from "../xml/xsd-validator";
import { firmarXml } from "../signing/xmldsig";
import { autenticar } from "../dgii/client";
import { ANULACION, formatoFechaHora } from "../dgii/endpoints";
import { contexto } from "./emision";

/**
 * **Anulación de e-NCF no utilizados** ante la DGII (formato ANECF).
 *
 * Fuentes (ver `docs/fec/REQUISITOS.md` §4.20):
 *  - *Formato Anulación de e-NCF v1.0*: estructura, reglas de los rangos y
 *    cuándo procede ("si la factura emitida no ha sido enviada a la DGII ni al
 *    receptor o si la secuencia no ha sido utilizada").
 *  - *Descripción Técnica Servicios DGII* → "Anulación de e-NCF": URL, método
 *    y respuesta `{ rnc, codigo, nombre, mensajes[] }`.
 *
 * Venilu solo anula números que **nunca asignó** (≥ `next_number` de su
 * secuencia): todo e-NCF ya asignado se entregó impreso al cliente, y para
 * esos la DGII exige una Nota de Crédito.
 *
 * El rango queda bloqueado localmente (estado `pendiente`) ANTES de enviarlo:
 * aunque falle la red, la numeración ya no lo usa. Solo una respuesta de
 * rechazo de la DGII lo libera.
 */

export interface AnulacionView {
    id: string;
    tipo: 31 | 32 | 34;
    desde: string;
    hasta: string;
    cantidad: number;
    estado: EcfAnulacion["estado"];
    ambiente: string;
    dgii_codigo: string | null;
    dgii_nombre: string | null;
    dgii_mensajes: string | null;
    last_error: string | null;
    username: string | null;
    created_at: string;
}

interface RespuestaAnulacion {
    rnc?: string;
    codigo?: string | number;
    nombre?: string;
    mensajes?: string[] | string;
}

function vista(a: EcfAnulacion): AnulacionView {
    return {
        id: a.id,
        tipo: a.tipo,
        desde: a.desde,
        hasta: a.hasta,
        cantidad: a.cantidad,
        estado: a.estado,
        ambiente: a.ambiente,
        dgii_codigo: a.dgii_codigo ?? null,
        dgii_nombre: a.dgii_nombre ?? null,
        dgii_mensajes: a.dgii_mensajes ?? null,
        last_error: a.last_error ?? null,
        username: a.username ?? null,
        created_at: new Date(a.created_at).toISOString(),
    };
}

/** JSON (`{ rnc, codigo, nombre, mensajes }`) o el XML `<RespuestaAnulacionRango>`. */
export function parsearRespuestaAnulacion(texto: string): RespuestaAnulacion {
    const t = texto.trim();
    if (!t) return {};
    if (t.startsWith("{")) {
        try {
            return JSON.parse(t) as RespuestaAnulacion;
        } catch {
            /* cae al parseo por tag */
        }
    }
    const tag = (n: string) => new RegExp(`<${n}>([\\s\\S]*?)</${n}>`, "i").exec(t)?.[1]?.trim();
    const mensajes = [...t.matchAll(/<mensajes>([\s\S]*?)<\/mensajes>/gi)].map((m) => m[1].trim());
    return { rnc: tag("rnc"), codigo: tag("codigo"), nombre: tag("nombre"), mensajes };
}

/**
 * Clasifica la respuesta por sus mensajes, que son los textos que la DGII
 * publica en VALIDACIONES:
 *   "Las secuencias fueron anuladas correctamente. Con excepción de las
 *    secuencias del detalle" → `parcial` (o `aceptada` sin la excepción).
 * Cualquier otro mensaje ("han sido utilizadas", "No fue posible anular…",
 * "La firma del documento no es válida"…) → `rechazada`.
 * Los valores de `codigo` no están publicados (REQUISITOS §5.11).
 */
export function clasificarAnulacion(r: RespuestaAnulacion): "aceptada" | "parcial" | "rechazada" {
    const textos = [r.nombre, ...(Array.isArray(r.mensajes) ? r.mensajes : [r.mensajes])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
    if (!textos.includes("anuladas correctamente")) return "rechazada";
    return textos.includes("excepción") || textos.includes("excepcion") ? "parcial" : "aceptada";
}

const repo = () => AppDataSource.getRepository(EcfAnulacion);

export class AnulacionService {
    async listar(limite = 100): Promise<AnulacionView[]> {
        const filas = await repo().find({ order: { created_at: "DESC" }, take: limite });
        return filas.map(vista);
    }

    /**
     * Comprueba que `[desde, hasta]` sea anulable y devuelve la secuencia que
     * lo contiene. Exportado para las pruebas.
     */
    async validarRangoLocal(tipo: NcfType, desde: number, hasta: number): Promise<NcfSequence> {
        if (!["31", "32", "34"].includes(tipo)) throw new Error("Solo se anulan e-NCF de los tipos 31, 32 y 34.");
        if (!Number.isInteger(desde) || !Number.isInteger(hasta) || desde < 1 || hasta < desde) {
            throw new Error("Rango inválido: «desde» debe ser ≥ 1 y menor o igual que «hasta».");
        }

        const secuencias = await AppDataSource.getRepository(NcfSequence).find({ where: { type: tipo } });
        const seq = secuencias.find((s) => s.from_number <= desde && hasta <= s.to_number);
        if (!seq) {
            throw new Error(
                `El rango ${formatNcf(tipo, desde)}–${formatNcf(tipo, hasta)} no está dentro de una secuencia ${tipo} registrada.`
            );
        }
        if (desde < seq.next_number) {
            throw new Error(
                `${formatNcf(tipo, desde)} ya se asignó a una venta: solo se anulan números no usados ` +
                    `(desde ${formatNcf(tipo, seq.next_number)}). Para un comprobante ya entregado, emite una Nota de Crédito.`
            );
        }

        const previas = await repo().find({ where: { tipo: Number(tipo) as 31 | 32 | 34, estado: Not("rechazada") } });
        const choque = previas.find((a) => desde <= Number(a.hasta.slice(3)) && hasta >= Number(a.desde.slice(3)));
        if (choque) {
            throw new Error(`El rango se solapa con la anulación ${choque.desde}–${choque.hasta} (${choque.estado}).`);
        }
        return seq;
    }

    /** Registra, firma y envía la anulación de `[desde, hasta]` del tipo dado. */
    async anular(
        datos: { tipo: NcfType; desde: number; hasta: number },
        username?: string | null
    ): Promise<AnulacionView> {
        const tipo = String(datos.tipo) as NcfType;
        const desde = Number(datos.desde);
        const hasta = Number(datos.hasta);
        await this.validarRangoLocal(tipo, desde, hasta);

        const { cert, ambiente, settings } = await contexto();
        const rnc = String(settings.business_tax_id ?? "").replace(/\D/g, "");
        if (rnc.length !== 9 && rnc.length !== 11) {
            throw new Error("El RNC del negocio en Ajustes → Fiscal no es válido (9 u 11 dígitos).");
        }

        const encfDesde = formatNcf(tipo, desde);
        const encfHasta = formatNcf(tipo, hasta);
        const { xml, total } = buildAnecfXml({
            rncEmisor: rnc,
            fechaHora: formatoFechaHora(new Date()),
            lineas: [{ tipo: Number(tipo) as 31 | 32 | 34, rangos: [{ desde: encfDesde, hasta: encfHasta }] }],
        });
        const firmado = firmarXml(xml, cert);
        const check = validateAnecf(firmado, { requireSignature: true });
        if (!check.valid) throw new Error(`El ANECF firmado no cumple ANECF v.1.0.xsd:\n${formatIssues(check)}`);

        // Bloqueo local antes de la red.
        const fila = await repo().save(
            repo().create({
                tipo: Number(tipo) as 31 | 32 | 34,
                desde: encfDesde,
                hasta: encfHasta,
                cantidad: total,
                estado: "pendiente",
                ambiente,
                signed_xml: firmado,
                username: username ?? null,
            })
        );
        return this.enviar(fila.id);
    }

    /** (Re)envía una anulación `pendiente` a la DGII. */
    async enviar(id: string): Promise<AnulacionView> {
        const fila = await repo().findOneBy({ id });
        if (!fila) throw new Error("Anulación no encontrada.");
        if (fila.estado !== "pendiente") throw new Error(`La anulación ya está ${fila.estado}.`);
        if (!fila.signed_xml) throw new Error("La anulación no tiene XML firmado.");

        try {
            const { cert, settings } = await contexto();
            const ambiente = fila.ambiente as Parameters<typeof ANULACION.rangos>[0];
            const token = await autenticar(ambiente, cert);
            const rnc = String(settings.business_tax_id ?? "").replace(/\D/g, "");

            const form = new FormData();
            // El nombre de archivo del ANECF no está normado (REQUISITOS §5.11):
            // se sigue el patrón RNC + e-NCF de los demás formatos.
            form.append("xml", new Blob([fila.signed_xml], { type: "text/xml" }), `${rnc}${fila.desde}.xml`);

            const r = await fetch(ANULACION.rangos(ambiente), {
                method: "POST",
                headers: { accept: "application/json", Authorization: `bearer ${token}` },
                body: form,
                signal: AbortSignal.timeout(60_000),
            });
            const texto = await r.text();
            const resp = parsearRespuestaAnulacion(texto);

            if (!r.ok && !resp.mensajes && !resp.nombre) {
                throw new Error(`La DGII respondió HTTP ${r.status}: ${texto.slice(0, 300)}`);
            }

            const mensajes = Array.isArray(resp.mensajes) ? resp.mensajes : resp.mensajes ? [resp.mensajes] : [];
            fila.dgii_codigo = resp.codigo !== undefined ? String(resp.codigo) : null;
            fila.dgii_nombre = resp.nombre ?? null;
            fila.dgii_mensajes = mensajes.join("\n") || null;
            fila.estado = clasificarAnulacion(resp);
            fila.last_error = null;
        } catch (err) {
            fila.last_error = err instanceof Error ? err.message : String(err);
        }
        return vista(await repo().save(fila));
    }

    /** Anulaciones que bloquean numeración (todas menos las rechazadas). */
    async vigentes(tipos: Array<31 | 32 | 34> = [31, 32, 34]): Promise<EcfAnulacion[]> {
        return repo().find({ where: { tipo: In(tipos), estado: Not("rechazada") } });
    }
}

export const anulacionService = new AnulacionService();
