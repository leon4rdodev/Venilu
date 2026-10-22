import { AppDataSource } from "@main/config/data-source";

import { EcfDocument } from "../entities/ecf-document.entity";
import { ecfService } from "../services/ecf.service";
import { emitirDocumento, firmarDocumento } from "../services/emision";
import { datosRepresentacionImpresa, type DatosRI } from "./representacion-impresa";

/**
 * Prepara la Representación Impresa de un e-CF para imprimirla.
 *
 *  1. Si el comprobante aún no está firmado, lo firma en el momento (sin red):
 *     el código de seguridad y la fecha de firma salen de la firma.
 *  2. Si se pide, intenta transmitirlo durante unos segundos. Si no llega a
 *     la DGII en ese tiempo, la RI lleva la leyenda de contingencia
 *     (Informe Técnico §19.1) y el worker lo seguirá reintentando.
 *
 * Nunca lanza: si algo falla devuelve `aviso` y la venta se imprime igual,
 * para que el cajero sepa que el comprobante no está completo.
 */

export interface ResultadoRI {
    datos: DatosRI | null;
    /** `true` → imprimir la leyenda de contingencia. */
    contingencia: boolean;
    /** Mensaje para el cajero cuando la RI no se pudo completar. */
    aviso: string | null;
    doc: EcfDocument | null;
}

/** Cuánto esperar la transmisión antes de imprimir con leyenda. */
const ESPERA_TRANSMISION_MS = 5_000;
/** Si el worker tiene el documento tomado, reintentar la firma así. */
const REINTENTOS_BLOQUEO = 10;
const PAUSA_BLOQUEO_MS = 300;

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

const repo = () => AppDataSource.getRepository(EcfDocument);

/** e-CF de la venta (la factura, no sus notas de crédito). */
export async function ecfDeVenta(saleId: string, ncf: string | null | undefined): Promise<EcfDocument | null> {
    if (!ncf) return null;
    return repo().findOneBy({ sale_id: saleId, encf: ncf });
}

async function firmarConEspera(doc: EcfDocument): Promise<EcfDocument> {
    for (let i = 0; ; i++) {
        try {
            return await firmarDocumento(doc.id);
        } catch (err) {
            const ocupado = err instanceof Error && /ya se está procesando/.test(err.message);
            if (!ocupado || i >= REINTENTOS_BLOQUEO) throw err;
            await pausa(PAUSA_BLOQUEO_MS);
            const actual = await repo().findOneBy({ id: doc.id });
            if (actual && actual.estado !== "draft") return actual;
        }
    }
}

export async function prepararRI(
    documento: EcfDocument,
    opciones: { transmitir?: boolean } = {}
): Promise<ResultadoRI> {
    let doc = documento;

    if (doc.estado === "draft") {
        try {
            doc = await firmarConEspera(doc);
        } catch (err) {
            return {
                datos: null,
                contingencia: false,
                doc,
                aviso:
                    `El e-CF ${doc.encf} no se pudo firmar, así que el ticket sale sin QR ni código de seguridad: ` +
                    (err instanceof Error ? err.message : String(err)),
            };
        }
    }

    if (opciones.transmitir && (doc.estado === "signed" || doc.estado === "queued")) {
        const intento = emitirDocumento(doc.id).catch(() => null);
        await Promise.race([intento, pausa(ESPERA_TRANSMISION_MS)]);
        doc = (await repo().findOneBy({ id: doc.id })) ?? doc;
    }

    if (!doc.signed_xml || !doc.codigo_seguridad) {
        return { datos: null, contingencia: false, doc, aviso: `El e-CF ${doc.encf} no tiene firma.` };
    }

    try {
        const { ambiente } = await ecfService.obtenerConfig();
        const datos = datosRepresentacionImpresa(doc.signed_xml, doc.codigo_seguridad, ambiente);
        const contingencia = doc.estado === "signed" || doc.estado === "queued";
        const aviso =
            doc.estado === "rejected"
                ? `La DGII rechazó el e-CF ${doc.encf}: esta representación impresa no sustenta crédito fiscal.`
                : null;
        return { datos, contingencia, aviso, doc };
    } catch (err) {
        return {
            datos: null,
            contingencia: false,
            doc,
            aviso: `No se pudo armar la representación impresa de ${doc.encf}: ${
                err instanceof Error ? err.message : String(err)
            }`,
        };
    }
}
