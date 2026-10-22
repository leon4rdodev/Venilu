import { safeStorage } from "electron";
import { EntityManager } from "typeorm";
import { AppDataSource } from "@main/config/data-source";
import { EcfDocument } from "@main/modules/ecf/entities/ecf-document.entity";
import { Setting } from "@main/modules/settings/entities/setting.entity";
import type { Ambiente } from "@main/modules/ecf/dgii/endpoints";
import { esCodigoUbicacion, municipioEnProvincia } from "@shared/ubicaciones";

/** Tope de la Factura de Consumo Electrónica que va por RFCE (< RD$250,000). */
export const TOPE_RFCE = 250_000;

/** Documento e-CF tal como lo consume la UI (sin el XML, que es grande). */
export interface EcfDocumentView {
    id: string;
    sale_id: string | null;
    tipo: 31 | 32 | 34;
    encf: string;
    via: "ecf" | "rfce";
    estado: EcfDocument["estado"];
    rnc_emisor: string | null;
    rnc_comprador: string | null;
    nombre_comprador: string | null;
    monto_total: number;
    itbis_total: number;
    fecha_emision: string | null;
    codigo_seguridad: string | null;
    ncf_reemplazado: string | null;
    fecha_ncf_reemplazado: string | null;
    track_id: string | null;
    dgii_code: number | null;
    dgii_estado: string | null;
    dgii_mensajes: string | null;
    last_error: string | null;
    intentos: number;
    sent_at: string | null;
    resolved_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface EcfStats {
    total: number;
    draft: number;
    signed: number;
    queued: number;
    sent: number;
    accepted: number;
    rejected: number;
    /**
     * Pendientes de transmitir hace más de 72 h: fuera del plazo de la
     * contingencia por falta de conectividad (Informe Técnico §19.1: "Enviar
     * los e-CF pendientes a la DGII una vez restablecida la conexión, en un
     * plazo no mayor de setenta y dos (72) horas").
     */
    fuera_de_plazo: number;
    /** Pendientes de transmitir hace más de 48 h (y menos de 72 h). */
    por_vencer: number;
}

/** Plazo para transmitir un e-CF emitido sin conexión (§19.1). */
export const PLAZO_TRANSMISION_MS = 72 * 60 * 60 * 1000;
const AVISO_TRANSMISION_MS = 48 * 60 * 60 * 1000;

export interface EcfConfigView {
    ambiente: Ambiente;
    cert_path: string | null;
    /** `true` si hay ruta y la contraseña guardada. No expone la contraseña. */
    has_password: boolean;
    /** Datos del emisor que la Representación Impresa exige (§4.18). */
    nombre_comercial: string | null;
    /** Código DGII de 6 dígitos (`ProvinciaMunicipioType`). */
    provincia: string | null;
    municipio: string | null;
}

const ESTADOS = ["draft", "signed", "queued", "sent", "accepted", "rejected"] as const;

function num(v: unknown): number {
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? n : 0;
}

function fecha(d: Date | null | undefined): string | null {
    return d ? new Date(d).toISOString() : null;
}

export class EcfService {
    // ── Documentos ────────────────────────────────────────────────────────

    /**
     * Registra el e-CF recién numerado DENTRO de la transacción de la venta
     * (o de la anulación): si la transacción falla, ni el e-NCF ni el
     * documento quedan huérfanos. El estado `draft` significa "e-NCF
     * asignado, XML pendiente de construir y firmar".
     */
    async registrarDraft(manager: EntityManager, data: {
        sale_id?: string;
        tipo: 31 | 32 | 34;
        encf: string;
        rnc_emisor?: string;
        rnc_comprador?: string;
        nombre_comprador?: string;
        monto_total: number;
        itbis_total: number;
        fecha_emision: string;
        /** Reemplazo de contingencia: NCF serie B que este e-CF reemplaza. */
        ncf_reemplazado?: string;
        /** `dd-MM-yyyy` — fecha de emisión del NCF reemplazado. */
        fecha_ncf_reemplazado?: string;
    }): Promise<EcfDocument> {
        const via: "ecf" | "rfce" =
            data.tipo === 32 && num(data.monto_total) < TOPE_RFCE ? "rfce" : "ecf";

        const doc = manager.create(EcfDocument, {
            sale_id: data.sale_id,
            tipo: data.tipo,
            encf: data.encf,
            via,
            estado: "draft",
            rnc_emisor: data.rnc_emisor,
            rnc_comprador: data.rnc_comprador,
            nombre_comprador: data.nombre_comprador,
            monto_total: num(data.monto_total),
            itbis_total: num(data.itbis_total),
            fecha_emision: data.fecha_emision,
            ncf_reemplazado: data.ncf_reemplazado ?? null,
            fecha_ncf_reemplazado: data.fecha_ncf_reemplazado ?? null,
        });
        return manager.save(EcfDocument, doc);
    }

    /** Últimos e-CF emitidos, más recientes primero. */
    async listar(limite = 200): Promise<EcfDocumentView[]> {
        const rows = await AppDataSource.getRepository(EcfDocument).find({
            order: { created_at: "DESC" },
            take: Math.max(1, Math.min(1000, limite)),
        });
        return rows.map((r) => this.vista(r));
    }

    async obtener(id: string): Promise<EcfDocumentView | null> {
        const row = await AppDataSource.getRepository(EcfDocument).findOneBy({ id });
        return row ? this.vista(row) : null;
    }

    async stats(ahora = Date.now()): Promise<EcfStats> {
        const rows = await AppDataSource.getRepository(EcfDocument).find({
            select: ["estado", "created_at", "ncf_reemplazado"],
        });
        const stats: EcfStats = { total: rows.length, fuera_de_plazo: 0, por_vencer: 0 } as EcfStats;
        for (const e of ESTADOS) stats[e] = 0;
        for (const r of rows) {
            const e = (ESTADOS as readonly string[]).includes(r.estado) ? r.estado : "draft";
            stats[e as (typeof ESTADOS)[number]] += 1;

            // El plazo de 72 h es de los e-CF entregados sin conexión; los
            // reemplazos de contingencia corren "a partir del levantamiento".
            if (r.ncf_reemplazado) continue;
            if (e !== "draft" && e !== "signed" && e !== "queued") continue;
            const edad = ahora - new Date(r.created_at).getTime();
            if (edad > PLAZO_TRANSMISION_MS) stats.fuera_de_plazo += 1;
            else if (edad > AVISO_TRANSMISION_MS) stats.por_vencer += 1;
        }
        return stats;
    }

    private vista(r: EcfDocument): EcfDocumentView {
        return {
            id: r.id,
            sale_id: r.sale_id ?? null,
            tipo: r.tipo,
            encf: r.encf,
            via: r.via,
            estado: r.estado,
            rnc_emisor: r.rnc_emisor ?? null,
            rnc_comprador: r.rnc_comprador ?? null,
            nombre_comprador: r.nombre_comprador ?? null,
            monto_total: num(r.monto_total),
            itbis_total: num(r.itbis_total),
            fecha_emision: r.fecha_emision ?? null,
            codigo_seguridad: r.codigo_seguridad ?? null,
            ncf_reemplazado: r.ncf_reemplazado ?? null,
            fecha_ncf_reemplazado: r.fecha_ncf_reemplazado ?? null,
            track_id: r.track_id ?? null,
            dgii_code: r.dgii_code ?? null,
            dgii_estado: r.dgii_estado ?? null,
            dgii_mensajes: r.dgii_mensajes ?? null,
            last_error: r.last_error ?? null,
            intentos: r.intentos ?? 0,
            sent_at: fecha(r.sent_at),
            resolved_at: fecha(r.resolved_at),
            created_at: fecha(r.created_at) ?? new Date().toISOString(),
            updated_at: fecha(r.updated_at) ?? new Date().toISOString(),
        };
    }

    // ── Ajustes e-CF (certificado + ambiente) ─────────────────────────────

    async obtenerConfig(): Promise<EcfConfigView> {
        const s = await this.settings();
        return {
            ambiente: (s.ecf_ambiente as Ambiente) || "testecf",
            cert_path: s.ecf_cert_path ?? null,
            has_password: Boolean(s.ecf_cert_password),
            nombre_comercial: s.ecf_nombre_comercial ?? null,
            provincia: s.ecf_provincia ?? null,
            municipio: s.ecf_municipio ?? null,
        };
    }

    async guardarConfig(datos: {
        ambiente?: string;
        cert_path?: string;
        cert_password?: string;
        nombre_comercial?: string | null;
        provincia?: string | null;
        municipio?: string | null;
    }): Promise<EcfConfigView> {
        const s = await this.settings();

        if (datos.nombre_comercial !== undefined) {
            const nombre = String(datos.nombre_comercial ?? "").trim();
            // XSD `AlfNum150Type` de <NombreComercial>.
            if (nombre.length > 150) throw new Error("El nombre comercial admite hasta 150 caracteres.");
            s.ecf_nombre_comercial = nombre || undefined;
        }
        if (datos.provincia !== undefined || datos.municipio !== undefined) {
            const provincia = String(datos.provincia ?? s.ecf_provincia ?? "").trim();
            const municipio = String(datos.municipio ?? s.ecf_municipio ?? "").trim();
            if (provincia && !(esCodigoUbicacion(provincia) && provincia.endsWith("0000"))) {
                throw new Error("Provincia inválida: elíjala de la lista oficial de la DGII.");
            }
            if (municipio && (!provincia || !municipioEnProvincia(municipio, provincia))) {
                throw new Error("El municipio no pertenece a la provincia elegida.");
            }
            s.ecf_provincia = provincia || undefined;
            s.ecf_municipio = municipio || undefined;
        }

        if (datos.ambiente !== undefined) {
            if (!["testecf", "certecf", "ecf"].includes(datos.ambiente)) {
                throw new Error("Ambiente inválido. Use testecf, certecf o ecf.");
            }
            s.ecf_ambiente = datos.ambiente;
        }
        if (datos.cert_path !== undefined) {
            const ruta = datos.cert_path.trim();
            s.ecf_cert_path = ruta || undefined;
            if (!ruta) {
                // Quitar el certificado deja la contraseña sin objeto.
                s.ecf_cert_password = undefined;
            } else if (datos.cert_password !== undefined) {
                // Se guardan juntos: ruta y contraseña son un par.
                s.ecf_cert_password = cifrar(datos.cert_password);
            }
        } else if (datos.cert_password) {
            // Solo cambió la contraseña.
            s.ecf_cert_password = cifrar(datos.cert_password);
        }

        await AppDataSource.getRepository(Setting).save(s);
        return this.obtenerConfig();
    }

    /** Contraseña del certificado, descifrada. Solo para el proceso main. */
    async passwordCertificado(): Promise<string | null> {
        const s = await this.settings();
        return s.ecf_cert_password ? descifrar(s.ecf_cert_password) : null;
    }

    private async settings(): Promise<Setting> {
        const repo = AppDataSource.getRepository(Setting);
        const s = await repo.findOneBy({ id: 1 });
        if (s) return s;
        return repo.save(repo.create({ id: 1 }));
    }
}

/**
 * Cifrado de la contraseña del certificado con la llave del sistema
 * (`safeStorage` de Electron). Si el SO no ofrece cifrado se guarda en claro
 * y se deja constancia en el log: es mejor que no guardarla.
 */
function cifrar(texto: string): string {
    if (!texto) return "";
    try {
        if (safeStorage.isEncryptionAvailable()) {
            return `enc:${safeStorage.encryptString(texto).toString("base64")}`;
        }
        console.warn("[e-CF] safeStorage no disponible: contraseña guardada sin cifrar.");
    } catch {
        console.warn("[e-CF] safeStorage inaccesible: contraseña guardada sin cifrar.");
    }
    return texto;
}

function descifrar(valor: string): string {
    if (!valor.startsWith("enc:")) return valor;
    try {
        return safeStorage.decryptString(Buffer.from(valor.slice(4), "base64"));
    } catch (err) {
        throw new Error(
            `No se pudo descifrar la contraseña del certificado: ${err instanceof Error ? err.message : "error desconocido"}`
        );
    }
}

export const ecfService = new EcfService();
