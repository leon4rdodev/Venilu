import { DOMParser, type Element as El } from "@xmldom/xmldom";

import { urlTimbrePara } from "../dgii/qr";
import type { Ambiente } from "../dgii/endpoints";
import { nombreUbicacion } from "@shared/ubicaciones";

/**
 * **Representación Impresa (RI)** de un e-CF, derivada del XML **firmado**.
 *
 * Fuente: *Informe Técnico e-CF* (marzo 2026), §18 "Representación Impresa
 * (RI) del e-CF" — ver `docs/fec/REQUISITOS.md` §4.18. Se lee del XML firmado
 * (y no de la venta) para que lo impreso sea exactamente lo que recibe la DGII.
 *
 * Lo que la RI debe mostrar y de dónde sale cada dato:
 *
 *  §18.2.1-A  tipo de e-CF en palabras · e-NCF · Fecha Vencimiento (excepto
 *             32 y 34) · e-NCF Modificado y Código de Modificación en
 *             palabras (Notas de Crédito)
 *  §18.2.1-B  Nombre Comercial · Razón Social · RNC · Dirección · Municipio ·
 *             Provincia · Fecha de Emisión
 *  §18.2.1-C  Razón social y RNC del comprador (si aplica)
 *  §18.2.2    por línea: Cantidad, "E" si es exento, Descripción, Precio,
 *             Descuento, Valor; Subtotal Gravado, Subtotal Exento, Total
 *             ITBIS, Total
 *  §18.2.3    Código QR, Código de Seguridad y Fecha de Firma Digital
 */

/** Tipo de e-CF en palabras (XSD `TipoeCFType`, comentario literal). */
export const NOMBRE_TIPO_ECF: Record<31 | 32 | 34, string> = {
    31: "Factura de Crédito Fiscal Electrónica",
    32: "Factura de Consumo Electrónica",
    34: "Nota de Crédito Electrónica",
};

/** Código de modificación en palabras (Informe Técnico §18.2.1-A, recuadro). */
export const NOMBRE_CODIGO_MODIFICACION: Record<number, string> = {
    1: "Anula el NCF modificado",
    2: "Corrige Texto del Comprobante Fiscal modificado",
    3: "Corrige montos del NCF modificado",
    4: "Reemplazo NCF emitido en contingencia",
    5: "Referencia Factura de Consumo Electrónica",
};

/** `IndicadorFacturacion` 4 = "Exento (E)" (XSD `IndicadorFacturacionType`). */
const INDICADOR_EXENTO = "4";

export interface LineaRI {
    cantidad: string;
    /** Se imprime "E" a la izquierda de la descripción (§18.2.2). */
    exento: boolean;
    descripcion: string;
    precio: string;
    descuento: string | null;
    valor: string;
}

export interface DatosRI {
    tipo: 31 | 32 | 34;
    tipoNombre: string;
    encf: string;
    /** `dd-MM-yyyy` — solo en el tipo 31 (§18.2.1-A, nota 43). */
    fechaVencimiento: string | null;
    /** Notas de crédito y reemplazos de contingencia. */
    ncfModificado: string | null;
    codigoModificacion: number | null;
    codigoModificacionNombre: string | null;
    emisor: {
        rnc: string;
        razonSocial: string;
        nombreComercial: string | null;
        direccion: string;
        municipio: string | null;
        provincia: string | null;
        telefono: string | null;
    };
    fechaEmision: string;
    comprador: { rnc: string | null; nombre: string | null };
    lineas: LineaRI[];
    totales: {
        gravado: string | null;
        exento: string | null;
        itbis: string | null;
        total: string;
    };
    /** `dd-MM-yyyy HH:mm:ss` — `<FechaHoraFirma>` del XML firmado. */
    fechaFirma: string;
    codigoSeguridad: string;
    /** URL del timbre que codifica el QR. */
    urlQr: string;
}

/* ── lectura del XML ───────────────────────────────────────────────────── */

function hijos(el: El): El[] {
    const out: El[] = [];
    for (let i = 0; i < el.childNodes.length; i++) {
        const n = el.childNodes[i];
        if (n.nodeType === 1) out.push(n as El);
    }
    return out;
}

function nombre(el: El): string {
    return el.localName ?? el.nodeName;
}

function hijo(el: El | undefined, tag: string): El | undefined {
    return el ? hijos(el).find((h) => nombre(h) === tag) : undefined;
}

function ruta(el: El | undefined, ...tags: string[]): El | undefined {
    let actual = el;
    for (const t of tags) actual = hijo(actual, t);
    return actual;
}

function texto(el: El | undefined): string | null {
    if (!el) return null;
    let s = "";
    for (let i = 0; i < el.childNodes.length; i++) s += el.childNodes[i].nodeValue ?? "";
    const t = s.trim();
    return t === "" ? null : t;
}

function dinero(valor: string | null): string | null {
    if (valor === null) return null;
    const n = Number(valor);
    return Number.isFinite(n) ? n.toFixed(2) : valor;
}

function cantidad(valor: string | null): string {
    const n = Number(valor ?? 0);
    if (!Number.isFinite(n)) return valor ?? "";
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000);
}

/**
 * Extrae los datos de la RI del e-CF firmado.
 *
 * @param xmlFirmado      `ecf_documents.signed_xml`
 * @param codigoSeguridad `ecf_documents.codigo_seguridad`
 * @param ambiente        ambiente DGII del timbre (`testecf` / `certecf` / `ecf`)
 */
export function datosRepresentacionImpresa(
    xmlFirmado: string,
    codigoSeguridad: string,
    ambiente: Ambiente
): DatosRI {
    const raiz = new DOMParser().parseFromString(xmlFirmado, "text/xml").documentElement;
    if (!raiz) throw new Error("El e-CF firmado no tiene elemento raíz.");

    const idDoc = ruta(raiz, "Encabezado", "IdDoc");
    const emisor = ruta(raiz, "Encabezado", "Emisor");
    const comprador = ruta(raiz, "Encabezado", "Comprador");
    const totales = ruta(raiz, "Encabezado", "Totales");
    const referencia = hijo(raiz, "InformacionReferencia");

    const tipo = Number(texto(hijo(idDoc, "TipoeCF"))) as 31 | 32 | 34;
    if (!(tipo in NOMBRE_TIPO_ECF)) throw new Error(`Tipo de e-CF no soportado en la RI: ${tipo}.`);

    const encf = texto(hijo(idDoc, "eNCF")) ?? "";
    const rncEmisor = texto(hijo(emisor, "RNCEmisor")) ?? "";
    const rncComprador = texto(hijo(comprador, "RNCComprador"));
    const fechaEmision = texto(hijo(emisor, "FechaEmision")) ?? "";
    const montoTotal = texto(hijo(totales, "MontoTotal")) ?? "0.00";
    const fechaFirma = texto(hijo(raiz, "FechaHoraFirma"));
    if (!fechaFirma) throw new Error(`${encf}: el XML firmado no trae <FechaHoraFirma>.`);

    const lineas: LineaRI[] = hijos(ruta(raiz, "DetallesItems") ?? raiz)
        .filter((el) => nombre(el) === "Item")
        .map((item) => ({
            cantidad: cantidad(texto(hijo(item, "CantidadItem"))),
            exento: texto(hijo(item, "IndicadorFacturacion")) === INDICADOR_EXENTO,
            descripcion: texto(hijo(item, "NombreItem")) ?? "",
            precio: dinero(texto(hijo(item, "PrecioUnitarioItem"))) ?? "0.00",
            descuento: dinero(texto(hijo(item, "DescuentoMonto"))),
            valor: dinero(texto(hijo(item, "MontoItem"))) ?? "0.00",
        }));

    const codigoMod = texto(hijo(referencia, "CodigoModificacion"));
    const codigoModificacion = codigoMod === null ? null : Number(codigoMod);

    return {
        tipo,
        tipoNombre: NOMBRE_TIPO_ECF[tipo],
        encf,
        fechaVencimiento: tipo === 31 ? texto(hijo(idDoc, "FechaVencimientoSecuencia")) : null,
        ncfModificado: texto(hijo(referencia, "NCFModificado")),
        codigoModificacion,
        codigoModificacionNombre:
            codigoModificacion === null ? null : NOMBRE_CODIGO_MODIFICACION[codigoModificacion] ?? null,
        emisor: {
            rnc: rncEmisor,
            razonSocial: texto(hijo(emisor, "RazonSocialEmisor")) ?? "",
            nombreComercial: texto(hijo(emisor, "NombreComercial")),
            direccion: texto(hijo(emisor, "DireccionEmisor")) ?? "",
            municipio: nombreUbicacion(texto(hijo(emisor, "Municipio"))) || null,
            provincia: nombreUbicacion(texto(hijo(emisor, "Provincia"))) || null,
            telefono: texto(ruta(emisor, "TablaTelefonoEmisor", "TelefonoEmisor")),
        },
        fechaEmision,
        comprador: {
            rnc: rncComprador,
            nombre: texto(hijo(comprador, "RazonSocialComprador")),
        },
        lineas,
        totales: {
            gravado: dinero(texto(hijo(totales, "MontoGravadoTotal"))),
            exento: dinero(texto(hijo(totales, "MontoExento"))),
            itbis: dinero(texto(hijo(totales, "TotalITBIS"))),
            total: dinero(montoTotal) ?? "0.00",
        },
        fechaFirma,
        codigoSeguridad,
        // El monto del QR es el texto literal de <MontoTotal> (§5.4).
        urlQr: urlTimbrePara(tipo, montoTotal, {
            ambiente,
            rncEmisor,
            rncComprador,
            encf,
            fechaEmision,
            fechaFirma,
            codigoSeguridad,
        }),
    };
}

/**
 * Leyenda obligatoria cuando el e-CF se entrega sin haberse podido transmitir
 * (contingencia por falta de conectividad, Informe Técnico §19.1).
 *
 * Texto oficial: "…para su validez fiscal, partir de las setenta y dos (72)
 * horas". Se imprime con la preposición "a" que le falta al original.
 */
export const LEYENDA_CONTINGENCIA =
    "e-CF emitido en modalidad de Contingencia, el cual podrá ser consultado para su validez fiscal, " +
    "a partir de las setenta y dos (72) horas";
