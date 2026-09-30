import fs from "node:fs";

import { AppDataSource } from "@main/config/data-source";
import { Sale } from "@main/modules/sales/entities/sale.entity";
import { SaleReturn } from "@main/modules/sales/entities/sale-return.entity";
import { Setting } from "@main/modules/settings/entities/setting.entity";
import { NcfSequence } from "@main/modules/fiscal/entities/ncf-sequence.entity";

import { DOMParser, type Element as El } from "@xmldom/xmldom";

import { EcfDocument } from "../entities/ecf-document.entity";
import { ecfService } from "./ecf.service";
import {
    mapearVenta,
    type EmisorEcf,
    type LineaVenta,
    type VentaEcf,
    type VentaEcfMapeada,
} from "../xml/from-sale";
import { buildEcfXml, type EcfRawNode, type XmlScalar } from "../xml/build-ecf";
import { buildRfceXml } from "../xml/build-rfce";
import { assertValidEcf, formatIssues, validateEcf, validateRfce } from "../xml/xsd-validator";
import { firmarXml } from "../signing/xmldsig";
import { codigoSeguridad } from "../signing/security-code";
import { cargarCertificadoP12, type CertificadoDigital } from "../signing/p12";
import { autenticar } from "../dgii/client";
import {
    CONSULTAS,
    RECEPCION,
    type Ambiente,
    formatoFecha,
    formatoFechaHora,
    nombreArchivoXml,
} from "../dgii/endpoints";

/**
 * **Ciclo de emisión de un e-CF**: `draft → signed → queued → sent → accepted|rejected`.
 *
 * Este módulo implementa la Fase 3 (emitir / consultar) sobre el motor de la
 * Fase 1 (firma + XSD) y el cliente de la Fase 2 (autenticación). Toda regla
 * citada vive en `docs/fec/REQUISITOS.md`; los supuestos sin confirmar, en su
 * §5.
 *
 * ── Flujo ─────────────────────────────────────────────────────────────────
 *
 * `firmar`:   venta → `mapearVenta` → XML → XSD (sin firma) → firmar →
 *             XSD (con firma) → código de seguridad → `signed`.
 *             Si `via === 'rfce'` se comprueba además que el resumen se puede
 *             construir y validar con ese código.
 * `enviar`:   token (semilla) → multipart `xml` con nombre `RNC+e-NCF.xml` →
 *             `sent` con TrackId (e-CF) o el veredicto directo (RFCE).
 * `consultar`: por TrackId (e-CF) o por RNC+e-NCF+código (RFCE) →
 *             `accepted` / `rejected` o "en proceso" → nuevo intento.
 *
 * ── Dos decisiones que NO son obvias ───────────────────────────────────────
 *
 * 1. `signed_xml` guarda **siempre el e-CF extendido firmado** (E31/E32/E34),
 *    nunca el RFCE. La DGII lo exige ("el contribuyente deberá conservar el
 *    e-CF extendido correspondiente… para futuros procesos"). El RFCE es un
 *    artefacto derivado y determinista: se vuelve a construir y firmar en cada
 *    envío a partir de la venta y del código de seguridad ya guardado, sin
 *    migración de esquema nueva.
 * 2. Un `last_error` nunca rompe la venta: el comprobante se queda en su
 *    estado y se reintenta con backoff (ver `programarReintento`).
 */

/** Reintentos antes de dejar de apurar (24 h de pausa). Ver §4.15. */
const MAX_INTENTOS = 10;
/** Primer reintento: 30 s. */
const BASE_MS = 30_000;
/** Techo del backoff exponencial. */
const TOPE_MS = 6 * 60 * 60 * 1000;
/** Pausa cuando se agotan los reintentos automáticos. */
const PAUSA_MS = 24 * 60 * 60 * 1000;
/** Espera entre el envío aceptado y la primera consulta de estado. */
const PRIMERA_CONSULTA_MS = 60 * 1000;

/** Documentos en curso, para no procesar dos veces el mismo a la vez. */
const enCurso = new Set<string>();

const repositorio = () => AppDataSource.getRepository(EcfDocument);

async function cargar(id: string): Promise<EcfDocument> {
    const doc = await repositorio().findOneBy({ id });
    if (!doc) throw new Error("Comprobante e-CF no encontrado.");
    return doc;
}

async function guardar(doc: EcfDocument): Promise<EcfDocument> {
    return repositorio().save(doc);
}

async function conBloqueo<T>(id: string, accion: () => Promise<T>): Promise<T> {
    if (enCurso.has(id)) throw new Error("Ese comprobante ya se está procesando.");
    enCurso.add(id);
    try {
        return await accion();
    } finally {
        enCurso.delete(id);
    }
}

/**
 * Backoff: 30 s, 1 min, 2 min … 6 h y, al agotar los intentos, 24 h.
 * Se reprograma también cuando el fallo es de configuración (falta certificado,
 * falta dirección fiscal): corregido el ajuste, el siguiente intento ya sale.
 */
function programarReintento(doc: EcfDocument, motivo?: string): void {
    doc.intentos = (doc.intentos ?? 0) + 1;
    if (motivo) doc.last_error = motivo;
    const excedido = doc.intentos >= MAX_INTENTOS;
    const ms = excedido
        ? PAUSA_MS
        : Math.min(BASE_MS * 2 ** (doc.intentos - 1), TOPE_MS);
    doc.proximo_intento = new Date(Date.now() + ms);
}

/** Registra el fallo en la fila y devuelve el error tal cual para mostrarlo. */
async function registrarFallo(id: string, err: unknown): Promise<Error> {
    const error = err instanceof Error ? err : new Error(String(err));
    try {
        const doc = await cargar(id);
        if (doc.estado !== "accepted" && doc.estado !== "rejected") {
            programarReintento(doc, error.message);
            await guardar(doc);
        } else {
            doc.last_error = error.message;
            await guardar(doc);
        }
    } catch {
        // Si ni siquiera se puede leer la fila, el error original es más útil.
    }
    return error;
}

/* ── Contexto (certificado + emisor) ────────────────────────────────────── */

interface Contexto {
    cert: CertificadoDigital;
    ambiente: Ambiente;
    settings: Setting;
}

function soloDigitos(valor: string | undefined | null): string {
    return (valor ?? "").replace(/\D/g, "");
}

async function contexto(): Promise<Contexto> {
    const cfg = await ecfService.obtenerConfig();
    if (!cfg.cert_path) {
        throw new Error("No hay certificado digital (.p12) configurado en Ajustes → Fiscal.");
    }
    if (!fs.existsSync(cfg.cert_path)) {
        throw new Error(`El certificado configurado no existe: ${cfg.cert_path}`);
    }
    const clave = (await ecfService.passwordCertificado()) ?? "";
    const cert = cargarCertificadoP12(fs.readFileSync(cfg.cert_path), clave);

    const repo = AppDataSource.getRepository(Setting);
    const settings = (await repo.findOneBy({ id: 1 })) ?? repo.create({ id: 1 });

    return { cert, ambiente: cfg.ambiente, settings };
}

/**
 * Datos del emisor. `DireccionEmisor` y `RazonSocialEmisor` son obligatorios
 * en el XSD (`minOccurs="1"`), así que se comprueban ANTES de construir nada:
 * el error debe decir exactamente qué poner en Ajustes → Fiscal.
 */
function emisorDe(settings: Setting): EmisorEcf {
    const rnc = soloDigitos(settings.business_tax_id);
    if (rnc.length !== 9 && rnc.length !== 11) {
        throw new Error(
            `El RNC/Cédula del negocio en Ajustes → Fiscal no es válido (${rnc.length || 0} dígitos): ` +
                `el XSD de la DGII admite 9 u 11 dígitos.`
        );
    }
    const razonSocial = (settings.business_name ?? "").trim();
    if (!razonSocial) {
        throw new Error("Falta la razón social del negocio en Ajustes → Fiscal (obligatoria en el e-CF).");
    }
    const direccion = (settings.business_address ?? "").trim();
    if (!direccion) {
        throw new Error("Falta la dirección fiscal en Ajustes → Fiscal (obligatoria en el e-CF).");
    }

    return {
        rnc,
        razonSocial,
        direccion,
        telefono: (settings.business_phone ?? "").trim(),
        correo: (settings.business_email ?? "").trim(),
    };
}

/** `FechaVencimientoSecuencia` — **obligatoria en el e-CF 31**. */
async function vencimientoSecuencia(encf: string): Promise<string> {
    const secuencial = Number(encf.slice(3));
    if (!Number.isFinite(secuencial)) {
        throw new Error(`No se pudo leer el secuencial del e-NCF ${encf}.`);
    }
    const fila = await AppDataSource.getRepository(NcfSequence)
        .createQueryBuilder("s")
        .where("s.type = :type", { type: "31" })
        .andWhere("s.from_number <= :n AND s.to_number >= :n", { n: secuencial })
        .orderBy("s.created_at", "DESC")
        .getOne();

    if (!fila?.expires_at) {
        throw new Error(
            `La secuencia 31 que contiene ${encf} no tiene Fecha de Vencimiento registrada: ` +
                `el e-CF 31 no puede emitirse sin ella (Ajustes → Fiscal → Rangos e-NCF).`
        );
    }
    const [yyyy, mm, dd] = fila.expires_at.slice(0, 10).split("-");
    if (!yyyy || !mm || !dd) {
        throw new Error(`La fecha de vencimiento de la secuencia 31 no es válida: "${fila.expires_at}".`);
    }
    return `${dd}-${mm}-${yyyy}`;
}

/* ── Líneas de detalle ──────────────────────────────────────────────────── */

function nombreDe(item: Sale["items"][number]): string {
    return (item.product_name ?? item.product?.name ?? "").trim() || "Artículo";
}

function exentoDe(item: Sale["items"][number]): boolean {
    if (item.product) return Boolean(item.product.itbis_exempt);
    // Sin el producto (borrado), solo podemos usar el ITBIS de la línea.
    return Number(item.itbis_amount ?? 0) === 0;
}

/** Líneas de una venta completa (venta normal o anulación total). */
function lineasDeVenta(venta: Sale): LineaVenta[] {
    return (venta.items ?? []).map((item) => ({
        nombre: nombreDe(item),
        descripcion: item.product?.description ?? "",
        cantidad: Number(item.quantity),
        precioUnitario: Number(item.unit_price ?? 0),
        montoLinea: Number(item.total_price ?? 0),
        exento: exentoDe(item),
    }));
}

/**
 * Líneas de una **devolución**: solo lo devuelto, con el mismo criterio de
 * `sales.service` (bruto por unidad × cantidad devuelta). El descuento global
 * que se le prorrateó al reembolso lo calcula el llamador y lo pasa en
 * `VentaEcf.descuentoGlobal`; `mapearVenta` lo prorratea por el mismo criterio,
 * de modo que los totales de la NC cuadran con `SaleReturn.total_refunded`.
 */
function lineasDeDevolución(devolucion: SaleReturn, venta: Sale): LineaVenta[] {
    const lineas: LineaVenta[] = [];

    for (const ri of devolucion.items ?? []) {
        const origen = (venta.items ?? []).find((i) => i.id === ri.sale_item_id);
        if (!origen) continue;
        const qtyOrigen = Number(origen.quantity) || 1;
        const unidad = Number(origen.total_price ?? 0) / qtyOrigen;

        lineas.push({
            nombre: (ri.product_name ?? nombreDe(origen)).trim() || "Artículo",
            descripcion: origen.product?.description ?? "",
            cantidad: ri.quantity,
            precioUnitario: Math.round(unidad * 100) / 100,
            montoLinea: Math.round(unidad * ri.quantity * 100) / 100,
            exento: exentoDe(origen),
        });
    }

    return lineas;
}

/* ── Construcción del XML ───────────────────────────────────────────────── */

async function construirVentaEcf(doc: EcfDocument, settings: Setting): Promise<VentaEcf> {
    if (!doc.sale_id) {
        throw new Error(`El comprobante ${doc.encf} no tiene venta asociada: no se puede construir.`);
    }
    const venta = await AppDataSource.getRepository(Sale).findOne({
        where: { id: doc.sale_id },
        relations: ["items", "items.product"],
    });
    if (!venta) throw new Error(`La venta ${doc.sale_id} del comprobante ${doc.encf} ya no existe.`);
    if (!venta.items?.length) {
        throw new Error(`La venta ${doc.sale_id} no tiene líneas de detalle: no se puede emitir un e-CF.`);
    }

    const emisor = emisorDe(settings);
    const tasaItbis = Number(settings.itbis_rate ?? 18);
    const metodo = venta.payment_method;

    // ── Nota de Crédito (34): qué operación corrige ──────────────────────
    let referencia: VentaEcf["referencia"];
    let descuentoGlobal = Number(venta.discount_amount ?? 0);
    let lineas = lineasDeVenta(venta);

    if (doc.tipo === 34) {
        const ncfModificado = (venta.ncf ?? "").trim();
        if (!ncfModificado) {
            throw new Error(`La Nota de Crédito ${doc.encf} no tiene el NCF original que modifica.`);
        }

        const devolucion = await AppDataSource.getRepository(SaleReturn).findOne({
            where: { credit_note_ncf: doc.encf },
            relations: ["items"],
        });

        // Códigos de modificación (XSD `CodigoModificacionType`):
        //   1 "Anula el NCF modificado" · 3 "Corrige montos del NCF modificado"
        let codigoModificacion: number;
        if (devolucion) {
            codigoModificacion = 3;
            lineas = lineasDeDevolución(devolucion, venta);
            descuentoGlobal = Math.max(
                0,
                Math.round(
                    (lineas.reduce((s, l) => s + l.montoLinea, 0) - Number(devolucion.total_refunded ?? 0)) * 100
                ) / 100
            );
        } else {
            codigoModificacion = 1;
        }

        referencia = {
            encfModificado: ncfModificado,
            fechaModificado: formatoFecha(new Date(venta.created_at)),
            codigoModificacion,
            razonModificacion: devolucion
                ? `Devolución de mercancía de la venta ${venta.id}`
                : `Anulación de la venta ${venta.id}`,
        };
    }

    const fechaVencimiento =
        doc.tipo === 31 ? await vencimientoSecuencia(doc.encf) : undefined;

    return {
        tipo: doc.tipo,
        encf: doc.encf,
        fechaEmision: doc.fecha_emision ?? formatoFecha(new Date(venta.created_at)),
        fechaHoraFirma: formatoFechaHora(new Date()),
        vencimientoSecuencia: fechaVencimiento,
        emisor,
        compradorRnc: doc.rnc_comprador ?? undefined,
        compradorNombre: doc.nombre_comprador ?? undefined,
        referencia,
        lineas,
        descuentoGlobal,
        tasaItbis,
        metodoPago: metodo,
    };
}

/** Construye y valida (sin firmar) el XML del e-CF. */
function construirEcf(doc: EcfDocument, mapeo: VentaEcfMapeada, fechaHoraFirma: string): string {
    const { xml, descartados } = buildEcfXml({
        tipo: doc.tipo,
        encf: doc.encf,
        fechaHoraFirma,
        encabezado: mapeo.encabezado,
        detallesItems: mapeo.detallesItems,
        seccionesRaiz: mapeo.seccionesRaiz,
    });
    if (descartados.length > 0) {
        console.warn(`[e-CF] ${doc.encf}: tags descartados por no existir en el XSD: ${descartados.join(", ")}`);
    }
    const check = validateEcf(xml, doc.tipo, { requireSignature: false });
    if (!check.valid) {
        throw new Error(
            `El XML de ${doc.encf} no cumple el XSD oficial de la DGII:\n${formatIssues(check)}`
        );
    }
    return xml;
}

/* ── RFCE derivado del e-CF firmado ─────────────────────────────────────── */

function elementosDe(el: El): El[] {
    const out: El[] = [];
    for (let i = 0; i < el.childNodes.length; i++) {
        const n = el.childNodes[i];
        if (n.nodeType === 1) out.push(n as El);
    }
    return out;
}

function textoDe(el: El): string {
    let s = "";
    for (let i = 0; i < el.childNodes.length; i++) s += el.childNodes[i].nodeValue ?? "";
    return s.trim();
}

function aRaw(el: El): EcfRawNode | string {
    const hijos = elementosDe(el);
    if (hijos.length === 0) return textoDe(el);
    const out: EcfRawNode = {};
    for (const h of hijos) {
        const clave = h.localName ?? h.nodeName;
        const valor: EcfRawNode | string = aRaw(h);
        const previo = out[clave] as
            | XmlScalar
            | EcfRawNode
            | Array<XmlScalar | EcfRawNode>
            | undefined;
        if (previo === undefined) out[clave] = valor;
        else if (Array.isArray(previo)) previo.push(valor);
        else out[clave] = [previo, valor];
    }
    return out;
}

/** Raíz del XML firmado (falla con un mensaje claro si el XML está vacío). */
function raizDe(xmlFirmado: string): El {
    const raiz = new DOMParser().parseFromString(xmlFirmado, "text/xml").documentElement;
    if (!raiz) throw new Error("El e-CF firmado no tiene elemento raíz.");
    return raiz;
}

/** Primer hijo directo con ese nombre de tag. */
function buscar(el: El, nombre: string): El | undefined {
    return elementosDe(el).find((h) => (h.localName ?? h.nodeName) === nombre);
}

function ruta(raiz: El, ...nombres: string[]): El | undefined {
    let actual: El | undefined = raiz;
    for (const n of nombres) actual = actual ? buscar(actual, n) : undefined;
    return actual;
}

/**
 * Sección `<Emisor>` / `<Comprador>` / `<Totales>` **del e-CF ya firmado**.
 *
 * El RFCE se deriva del comprobante firmado (y no de la venta otra vez) para
 * que ambos documentos sean idénticos por construcción, aunque cambien los
 * Ajustes entre firmar y transmitir. Los tags que el RFCE no conoce se
 * descartan solos en `renderThroughSchema` (los tres casos se citan en
 * `docs/fec/REQUISITOS.md` §4.15).
 */
function seccionDelFirmado(xmlFirmado: string, nombre: "Emisor" | "Comprador" | "Totales"): EcfRawNode {
    const raiz = raizDe(xmlFirmado);
    const objetivo = ruta(raiz, "Encabezado", nombre);
    if (!objetivo) return {};
    const raw = aRaw(objetivo);
    return typeof raw === "string" ? {} : raw;
}

/** `IdDoc` del RFCE: solo los tags que el XSD `rfce-32` define. */
function idDocDelFirmado(xmlFirmado: string): EcfRawNode {
    const idDoc = ruta(raizDe(xmlFirmado), "Encabezado", "IdDoc");
    if (!idDoc) return {};
    const out: EcfRawNode = {};
    for (const etiqueta of ["TipoIngresos", "TipoPago", "TablaFormasPago"]) {
        const hijo = buscar(idDoc, etiqueta);
        if (hijo) out[etiqueta] = aRaw(hijo);
    }
    return out;
}

/** RNC del emisor, leído del propio e-CF firmado. */
function rncDelFirmado(xmlFirmado: string): string {
    const rnc = ruta(raizDe(xmlFirmado), "Encabezado", "Emisor", "RNCEmisor");
    return rnc ? textoDe(rnc) : "";
}

/**
 * Construye y (si se pasa el certificado) firma el RFCE del comprobante.
 * Se valida contra `rfce-32.xsd` antes de usarlo: con `cert` exige la firma.
 *
 * Exportada para poder probar la derivación `e-CF firmado → RFCE` sin tocar
 * la base de datos (ver `services/emision.test.ts`).
 */
export function construirRfce(doc: EcfDocument, cert?: CertificadoDigital): string {
    if (!doc.signed_xml) throw new Error(`${doc.encf} no tiene e-CF firmado: no hay RFCE que derivar.`);
    if (!doc.codigo_seguridad) throw new Error(`${doc.encf} no tiene código de seguridad.`);

    const { xml } = buildRfceXml({
        encf: doc.encf,
        idDoc: idDocDelFirmado(doc.signed_xml),
        emisor: seccionDelFirmado(doc.signed_xml, "Emisor"),
        comprador: seccionDelFirmado(doc.signed_xml, "Comprador"),
        totales: seccionDelFirmado(doc.signed_xml, "Totales"),
        codigoSeguridad: doc.codigo_seguridad,
    });

    const check = validateRfce(xml, { requireSignature: Boolean(cert) });
    if (!check.valid) {
        throw new Error(`El RFCE de ${doc.encf} no cumple rfce-32.xsd:\n${formatIssues(check)}`);
    }
    return cert ? firmarXml(xml, cert) : xml;
}

/* ── 1. Firmar ──────────────────────────────────────────────────────────── */

async function firmarInterno(id: string): Promise<EcfDocument> {
    const doc = await cargar(id);
    if (doc.estado !== "draft") {
        throw new Error(`${doc.encf} ya está "${doc.estado}": solo se firma una vez.`);
    }

    const { cert, settings } = await contexto();
    const ventaEcf = await construirVentaEcf(doc, settings);
    const mapeo = mapearVenta(ventaEcf);
    const xml = construirEcf(doc, mapeo, ventaEcf.fechaHoraFirma);

    const firmado = firmarXml(xml, cert);
    assertValidEcf(firmado, doc.tipo); // exige <Signature>

    doc.signed_xml = firmado;
    doc.codigo_seguridad = codigoSeguridad(firmado);
    doc.estado = "signed";
    doc.last_error = null;
    doc.intentos = 0;
    doc.proximo_intento = null;
    doc.resolved_at = null;

    // RFCE: además del e-CF, el resumen debe poder construirse con ese código.
    if (doc.via === "rfce") construirRfce(doc);

    return guardar(doc);
}

/* ── 2. Enviar ──────────────────────────────────────────────────────────── */

interface RespuestaRecepcion {
    trackId?: string;
    error?: string;
    mensaje?: string;
    codigo?: number;
    estado?: string;
    secuenciaUtilizada?: boolean;
    encf?: string;
    mensajes?: Array<{ valor?: string; codigo?: number | string }>;
}

/** JSON o el XML `<RespuestaRecepcion>`: la DGII puede devolver cualquiera. */
function parsearRespuesta(texto: string): RespuestaRecepcion {
    const recortado = texto.trim();
    if (!recortado) return {};
    if (recortado.startsWith("{")) {
        try {
            return JSON.parse(recortado) as RespuestaRecepcion;
        } catch {
            /* cae al parseo por tag */
        }
    }
    const porTag = (nombre: string): string | undefined => {
        const m = new RegExp(`<${nombre}>([^<]*)</${nombre}>`, "i").exec(recortado);
        return m ? m[1].trim() : undefined;
    };
    const mensajes = [...recortado.matchAll(/<Mensajes>([\s\S]*?)<\/Mensajes>/gi)].map((m) => ({
        valor: /<valor>([^<]*)<\/valor>/i.exec(m[1])?.[1]?.trim(),
        codigo: /<codigo>([^<]*)<\/codigo>/i.exec(m[1])?.[1]?.trim(),
    }));
    return {
        trackId: porTag("trackId"),
        error: porTag("error"),
        mensaje: porTag("mensaje"),
        codigo: Number(porTag("codigo")),
        estado: porTag("estado"),
        encf: porTag("encf"),
        mensajes: mensajes.length ? mensajes : undefined,
    };
}

/**
 * `0 No encontrado · 1 Aceptado · 2 Rechazado · 3 En proceso ·
 *  4 Aceptado condicional` (§4.5). El texto se lee primero porque el RFCE
 * devuelve la frase; el código, cuando la DGII no la manda.
 */
function clasificar(codigo: number | undefined, texto: string | undefined): "accepted" | "rejected" | "sent" {
    const t = (texto ?? "").toLowerCase();
    if (t.includes("rechaz")) return "rejected";
    if (t.includes("aceptad")) return "accepted";
    if (codigo === 2) return "rejected";
    if (codigo === 1 || codigo === 4) return "accepted";
    return "sent";
}

function textoMensajes(r: RespuestaRecepcion): string | null {
    if (!r.mensajes?.length) return null;
    return r.mensajes
        .map((m) => {
            const codigo = m.codigo !== undefined && m.codigo !== "" ? `${m.codigo}: ` : "";
            return `${codigo}${m.valor ?? ""}`.trim();
        })
        .filter(Boolean)
        .join("\n");
}

async function enviarInterno(id: string): Promise<EcfDocument> {
    const doc = await cargar(id);
    if (doc.estado !== "signed" && doc.estado !== "queued") {
        throw new Error(`${doc.encf} está en "${doc.estado}": no está listo para enviarse.`);
    }
    if (!doc.signed_xml) {
        throw new Error(`${doc.encf} no tiene XML firmado: fírmalo primero.`);
    }

    const { cert, ambiente, settings } = await contexto();
    const rncEmisor = rncDelFirmado(doc.signed_xml) || soloDigitos(settings.business_tax_id);

    // RFCE: se deriva del e-CF firmado y se firma en el momento (la firma
    // RSA-PKCS#1 es determinista, así que el resultado es reproducible).
    let payload = doc.signed_xml;
    if (doc.via === "rfce") payload = construirRfce(doc, cert);

    const token = await autenticar(ambiente, cert);
    const form = new FormData();
    form.append("xml", new Blob([payload], { type: "text/xml" }), nombreArchivoXml(rncEmisor, doc.encf));

    const url = doc.via === "rfce" ? RECEPCION.rfce(ambiente) : RECEPCION.ecf(ambiente);
    const r = await fetch(url, {
        method: "POST",
        headers: { accept: "application/json", Authorization: `bearer ${token}` },
        body: form,
        signal: AbortSignal.timeout(60_000),
    });
    const texto = await r.text();
    if (!r.ok) {
        throw new Error(`La DGII rechazó la recepción (HTTP ${r.status}): ${texto.slice(0, 300)}`);
    }

    const resp = parsearRespuesta(texto);

    if (doc.via === "ecf") {
        if (resp.error || resp.mensaje) {
            throw new Error(`La DGII no recibió ${doc.encf}: ${(resp.error || resp.mensaje)!.trim()}`);
        }
        if (!resp.trackId) {
            throw new Error(`Respuesta inesperada de la recepción: ${texto.slice(0, 300)}`);
        }
        doc.track_id = String(resp.trackId).trim();
        doc.estado = "sent";
        doc.sent_at = new Date();
        doc.intentos = 0;
        doc.last_error = null;
        doc.proximo_intento = new Date(Date.now() + PRIMERA_CONSULTA_MS);
        return guardar(doc);
    }

    // RFCE: la recepción devuelve el veredicto (sin TrackId).
    const codigo = Number.isFinite(Number(resp.codigo)) ? Number(resp.codigo) : undefined;
    const estado = clasificar(codigo, resp.estado);
    const mensajes = textoMensajes(resp);

    doc.dgii_code = codigo ?? null;
    doc.dgii_estado = resp.estado ?? null;
    doc.dgii_mensajes = mensajes;
    doc.estado = estado;
    doc.intentos = 0;
    doc.last_error = null;
    if (estado === "sent") {
        doc.sent_at = doc.sent_at ?? new Date();
        doc.proximo_intento = new Date(Date.now() + PRIMERA_CONSULTA_MS);
    } else {
        doc.resolved_at = new Date();
        doc.proximo_intento = null;
    }
    return guardar(doc);
}

/* ── 3. Consultar ───────────────────────────────────────────────────────── */

async function consultarInterno(id: string): Promise<EcfDocument> {
    const doc = await cargar(id);
    if (doc.estado !== "sent") {
        throw new Error(
            `${doc.encf} está en "${doc.estado}": la consulta de estado aplica a comprobantes ya transmitidos.`
        );
    }

    const { cert, ambiente, settings } = await contexto();
    const token = await autenticar(ambiente, cert);

    let url: string;
    if (doc.via === "rfce") {
        if (!doc.codigo_seguridad) {
            throw new Error(`${doc.encf} no tiene código de seguridad: fírmalo primero.`);
        }
        const q = new URLSearchParams({
            RNC_Emisor: doc.rnc_emisor || soloDigitos(settings.business_tax_id),
            ENCF: doc.encf,
            Cod_Seguridad_eCF: doc.codigo_seguridad,
        });
        url = `${CONSULTAS.rfce(ambiente)}?${q.toString()}`;
    } else {
        if (!doc.track_id) {
            throw new Error(`${doc.encf} no tiene TrackId: envíalo antes de consultar.`);
        }
        url = `${CONSULTAS.porTrackId(ambiente)}?trackid=${encodeURIComponent(doc.track_id)}`;
    }

    const r = await fetch(url, {
        method: "GET",
        headers: { accept: "application/json", Authorization: `bearer ${token}` },
        signal: AbortSignal.timeout(30_000),
    });
    const texto = await r.text();
    if (!r.ok) {
        throw new Error(`La DGII no respondió la consulta (HTTP ${r.status}): ${texto.slice(0, 300)}`);
    }

    const resp = parsearRespuesta(texto);
    const codigo = Number.isFinite(Number(resp.codigo)) ? Number(resp.codigo) : undefined;
    const estado = clasificar(codigo, resp.estado);
    const mensajes = textoMensajes(resp);

    doc.dgii_code = codigo ?? null;
    doc.dgii_estado = resp.estado ?? null;
    doc.dgii_mensajes = mensajes;

    if (estado === "sent") {
        // 0 No encontrado · 3 En proceso: se vuelve a consultar con backoff.
        doc.estado = "sent";
        programarReintento(doc);
        doc.last_error = null;
    } else {
        doc.estado = estado;
        doc.resolved_at = new Date();
        doc.proximo_intento = null;
        doc.intentos = 0;
        doc.last_error = null;
    }
    return guardar(doc);
}

/* ── API pública ────────────────────────────────────────────────────────── */

/** Firma (si hace falta) y transmite. Nunca lanza sin dejar `last_error`. */
export async function emitirDocumento(id: string): Promise<EcfDocument> {
    return conBloqueo(id, async () => {
        try {
            let doc = await cargar(id);
            if (doc.estado === "draft") doc = await firmarInterno(doc.id);
            if (doc.estado === "signed" || doc.estado === "queued") doc = await enviarInterno(doc.id);
            return doc;
        } catch (err) {
            throw await registrarFallo(id, err);
        }
    });
}

/** Consulta el estado de un comprobante ya transmitido. */
export async function consultarDocumento(id: string): Promise<EcfDocument> {
    return conBloqueo(id, async () => {
        try {
            return await consultarInterno(id);
        } catch (err) {
            throw await registrarFallo(id, err);
        }
    });
}

export interface ResumenProceso {
    emitidos: number;
    enviados: number;
    consultados: number;
    fallos: number;
}

interface Candidato {
    id: string;
    estado: EcfDocument["estado"];
    proximo_intento?: Date | null;
}

/**
 * Candidatos en `estados` cuyo `proximo_intento` ya venció.
 *
 * `requiereAgenda` (para `sent`): solo se toma lo que quedó agendado, así el
 * worker no sondea sin parar a los comprobantes ya transmitidos. Para
 * `draft`/`signed`/`queued`, `proximo_intento` nulo significa "nunca
 * intentado" → vence ya mismo.
 */
async function candidatos(
    estados: EcfDocument["estado"][],
    requiereAgenda = false
): Promise<Candidato[]> {
    const filas: Candidato[] = await repositorio()
        .createQueryBuilder("d")
        .select(["d.id", "d.estado", "d.proximo_intento"])
        .where("d.estado IN (:...estados)", { estados })
        .orderBy("d.created_at", "ASC")
        .take(500)
        .getMany();

    const ahora = Date.now();
    return filas.filter((f) => {
        if (enCurso.has(f.id)) return false;
        if (!f.proximo_intento) return !requiereAgenda;
        return new Date(f.proximo_intento).getTime() <= ahora;
    });
}

let procesando = false;

/**
 * Una pasada del worker: firma y transmite lo vencido y consulta los enviados.
 * `sent` solo se consulta si quedó agendada (evita sondear sin parar).
 */
export async function procesarPendientes(limite = 25): Promise<ResumenProceso> {
    const resumen: ResumenProceso = { emitidos: 0, enviados: 0, consultados: 0, fallos: 0 };
    if (procesando) return resumen;
    procesando = true;

    try {
        const porEmitir = (await candidatos(["draft", "signed", "queued"])).slice(0, limite);
        const porConsultar = (await candidatos(["sent"], true)).slice(0, limite);

        for (const c of porEmitir) {
            const estadoAntes = c.estado;
            try {
                await emitirDocumento(c.id);
                if (estadoAntes === "draft") resumen.emitidos += 1;
                else resumen.enviados += 1;
            } catch {
                resumen.fallos += 1;
            }
        }

        for (const c of porConsultar) {
            try {
                await consultarDocumento(c.id);
                resumen.consultados += 1;
            } catch {
                resumen.fallos += 1;
            }
        }
    } finally {
        procesando = false;
    }

    return resumen;
}
