import { In, IsNull, Not } from "typeorm";

import { AppDataSource } from "@main/config/data-source";
import { Sale } from "@main/modules/sales/entities/sale.entity";
import { SaleReturn } from "@main/modules/sales/entities/sale-return.entity";
import { Setting } from "@main/modules/settings/entities/setting.entity";
import { NcfSequence } from "@main/modules/fiscal/entities/ncf-sequence.entity";
import {
    EQUIVALENTE_ECF,
    fiscalService,
    normalizeRnc,
    tipoDeNcf,
    esTipoPapel,
    type NcfTipoPapel,
} from "@main/modules/fiscal/services/fiscal.service";

import { EcfContingencia } from "../entities/ecf-contingencia.entity";
import { EcfDocument } from "../entities/ecf-document.entity";
import { ecfService } from "./ecf.service";
import { formatoFecha } from "../dgii/endpoints";

/**
 * **Contingencia por imposibilidad técnica** (Informe Técnico e-CF, marzo 2026,
 * §19.2 — `docs/fec/REQUISITOS.md` §4.19).
 *
 *   "Esta contingencia aplica cuando una falla técnica impide al emisor
 *    generar los e-CF. […] el contribuyente deberá disponer de secuencias
 *    autorizadas de Comprobantes Fiscales No Electrónicos."
 *
 *   "Esta contingencia no podrá exceder de quince (15) días calendario."
 *
 *   "El emisor electrónico deberá reemplazar los comprobantes no electrónicos
 *    emitidos durante el período de contingencia y remitir a la DGII los e-CF
 *    correspondientes […] Cada e-CF de reemplazo deberá identificar el
 *    comprobante no electrónico correspondiente en la sección Información de
 *    Referencia" (`CodigoModificacion` 4).
 *
 *   "Los e-CF de reemplazo se enviarán únicamente a la DGII y no deberán
 *    remitirse al receptor."
 *
 * Flujo en Venilu:
 *   iniciar  → las ventas con comprobante toman NCF B01/B02/B04
 *              (`fiscalService.assignComprobante`), sin e-CF.
 *   finalizar → se cierra el período y se generan los e-CF de reemplazo, que
 *              el worker firma y transmite como cualquier otro.
 *
 * La entrada y la salida se registran ADEMÁS en la Oficina Virtual
 * (Facturación Electrónica → Contingencia FE): eso no lo puede hacer la app.
 */

/** Límite de la contingencia por imposibilidad técnica (Informe Técnico §19.2.1). */
export const LIMITE_DIAS_CONTINGENCIA = 15;

const DIA_MS = 86_400_000;

export interface ContingenciaView {
    id: string;
    desde: string;
    hasta: string | null;
    motivo: string;
    motivo_fin: string | null;
    username: string | null;
}

/** Comprobante serie B emitido en contingencia que aún no tiene e-CF de reemplazo. */
export interface PendienteReemplazo {
    origen: "venta" | "anulacion" | "devolucion";
    ncf: string;
    tipo: NcfTipoPapel;
    sale_id: string;
    fecha: string;
    monto: number;
}

export interface EstadoContingencia {
    activa: ContingenciaView | null;
    /** Días calendario transcurridos desde el inicio (contingencia activa). */
    dias: number | null;
    /** Fecha en que se cumplen los 15 días. */
    limite: string | null;
    excede_limite: boolean;
    historial: ContingenciaView[];
    pendientes_reemplazo: number;
    /** NCF serie B disponibles por tipo (secuencias activas y vigentes). */
    disponibles_b: Record<NcfTipoPapel, number>;
}

export interface ResumenReemplazos {
    creados: number;
    errores: string[];
}

function vista(c: EcfContingencia): ContingenciaView {
    return {
        id: c.id,
        desde: new Date(c.desde).toISOString(),
        hasta: c.hasta ? new Date(c.hasta).toISOString() : null,
        motivo: c.motivo,
        motivo_fin: c.motivo_fin ?? null,
        username: c.username ?? null,
    };
}

/**
 * `created_at` de ventas y devoluciones se guarda al segundo (`datetime('now')`
 * de SQLite); los límites del período, con milisegundos. Se compara al
 * segundo para no dejar fuera una venta hecha en el mismo segundo en que se
 * abrió o cerró la contingencia.
 */
function enPeriodo(fecha: Date | string | null | undefined, c: EcfContingencia): boolean {
    if (!fecha || !c.hasta) return false;
    const seg = (d: Date | string) => Math.floor(new Date(d).getTime() / 1000);
    const t = seg(fecha);
    return t >= seg(c.desde) && t <= seg(c.hasta);
}

const repo = () => AppDataSource.getRepository(EcfContingencia);

export class ContingenciaService {
    async estado(ahora = new Date()): Promise<EstadoContingencia> {
        const historial = await repo().find({ order: { desde: "DESC" }, take: 20 });
        const activa = historial.find((c) => !c.hasta) ?? null;

        let dias: number | null = null;
        let limite: string | null = null;
        if (activa) {
            dias = Math.floor((ahora.getTime() - new Date(activa.desde).getTime()) / DIA_MS);
            limite = new Date(new Date(activa.desde).getTime() + LIMITE_DIAS_CONTINGENCIA * DIA_MS).toISOString();
        }

        return {
            activa: activa ? vista(activa) : null,
            dias,
            limite,
            excede_limite: dias !== null && dias >= LIMITE_DIAS_CONTINGENCIA,
            historial: historial.map(vista),
            pendientes_reemplazo: (await this.pendientesReemplazo()).length,
            disponibles_b: await this.disponiblesB(ahora),
        };
    }

    private async disponiblesB(ahora: Date): Promise<Record<NcfTipoPapel, number>> {
        const filas = await AppDataSource.getRepository(NcfSequence).find({
            where: { type: In(["B01", "B02", "B04"]), active: true },
        });
        const out: Record<NcfTipoPapel, number> = { B01: 0, B02: 0, B04: 0 };
        for (const s of filas) {
            const vencida = s.expires_at ? ahora > new Date(`${s.expires_at}T23:59:59`) : false;
            if (vencida) continue;
            out[s.type as NcfTipoPapel] += Math.max(0, s.to_number - s.next_number + 1);
        }
        return out;
    }

    async iniciar(motivo: string, username?: string | null): Promise<ContingenciaView> {
        const texto = String(motivo ?? "").trim();
        if (texto.length < 5) throw new Error("Describe el motivo de la contingencia (mínimo 5 caracteres).");

        if (await fiscalService.contingenciaAbierta()) {
            throw new Error("Ya hay una contingencia activa.");
        }
        const settings = await AppDataSource.getRepository(Setting).findOneBy({ id: 1 });
        if (!settings?.fiscal_enabled) {
            throw new Error("La facturación con comprobantes no está activada (Ajustes → Fiscal).");
        }
        const disponibles = await this.disponiblesB(new Date());
        if (disponibles.B01 + disponibles.B02 === 0) {
            throw new Error(
                "No hay secuencias serie B (B01/B02) vigentes. La DGII exige disponer de comprobantes " +
                    "no electrónicos autorizados para operar en contingencia: regístralas en Ajustes → Fiscal."
            );
        }

        const c = await repo().save(
            repo().create({ desde: new Date(), motivo: texto.slice(0, 500), username: username ?? null })
        );
        return vista(c);
    }

    /**
     * Cierra la contingencia activa y genera los e-CF de reemplazo. Devuelve
     * el resumen de los reemplazos (los errores no impiden cerrar: se
     * reintentan con {@link generarReemplazos}).
     */
    async finalizar(
        motivoFin: string,
        username?: string | null
    ): Promise<{ contingencia: ContingenciaView; reemplazos: ResumenReemplazos }> {
        const activa = await fiscalService.contingenciaAbierta();
        if (!activa) throw new Error("No hay una contingencia activa.");
        const texto = String(motivoFin ?? "").trim();
        if (texto.length < 5) throw new Error("Indica cómo se resolvió la falla (mínimo 5 caracteres).");

        activa.hasta = new Date();
        activa.motivo_fin = texto.slice(0, 500);
        if (username && !activa.username) activa.username = username;
        await repo().save(activa);

        return { contingencia: vista(activa), reemplazos: await this.generarReemplazos() };
    }

    /**
     * Comprobantes serie B emitidos dentro de un período de contingencia ya
     * cerrado y que todavía no tienen e-CF de reemplazo. Las ventas B
     * anteriores al e-CF (facturación en papel histórica) NO entran: no
     * caen en ningún período.
     */
    async pendientesReemplazo(): Promise<PendienteReemplazo[]> {
        const periodos = (await repo().find({ where: { hasta: Not(IsNull()) } })) as EcfContingencia[];
        if (periodos.length === 0) return [];
        const dentro = (fecha: Date | string | null | undefined) => periodos.some((p) => enPeriodo(fecha, p));

        const yaReemplazados = new Set(
            (
                await AppDataSource.getRepository(EcfDocument).find({
                    select: ["ncf_reemplazado"],
                    where: { ncf_reemplazado: Not(IsNull()) },
                })
            ).map((d) => d.ncf_reemplazado as string)
        );

        const out: PendienteReemplazo[] = [];

        const ventas = await AppDataSource.getRepository(Sale).find({
            where: [{ ncf_type: In(["B01", "B02"]) }, { credit_note_ncf: Not(IsNull()) }],
        });
        for (const v of ventas) {
            if (v.ncf && esTipoPapel(v.ncf_type) && dentro(v.created_at) && !yaReemplazados.has(v.ncf)) {
                out.push({
                    origen: "venta",
                    ncf: v.ncf,
                    tipo: v.ncf_type as NcfTipoPapel,
                    sale_id: v.id,
                    fecha: new Date(v.created_at).toISOString(),
                    monto: Number(v.total_amount),
                });
            }
            const nc = v.credit_note_ncf;
            if (nc && tipoDeNcf(nc) === "B04" && dentro(v.voided_at) && !yaReemplazados.has(nc)) {
                out.push({
                    origen: "anulacion",
                    ncf: nc,
                    tipo: "B04",
                    sale_id: v.id,
                    fecha: new Date(v.voided_at!).toISOString(),
                    monto: Number(v.total_amount),
                });
            }
        }

        const devoluciones = await AppDataSource.getRepository(SaleReturn).find({
            where: { credit_note_ncf: Not(IsNull()) },
        });
        for (const d of devoluciones) {
            const nc = d.credit_note_ncf;
            if (nc && tipoDeNcf(nc) === "B04" && dentro(d.created_at) && !yaReemplazados.has(nc)) {
                out.push({
                    origen: "devolucion",
                    ncf: nc,
                    tipo: "B04",
                    sale_id: d.sale_id,
                    fecha: new Date(d.created_at).toISOString(),
                    monto: Number(d.total_refunded),
                });
            }
        }

        // Primero las facturas, luego las notas: una NC de reemplazo puede
        // necesitar que su factura ya tenga e-CF en la DGII.
        const orden = { venta: 0, anulacion: 1, devolucion: 1 } as const;
        return out.sort((a, b) => orden[a.origen] - orden[b.origen] || a.fecha.localeCompare(b.fecha));
    }

    /**
     * Crea un e-CF de reemplazo (estado `draft`) por cada comprobante B
     * pendiente. Cada uno en su propia transacción: si falta una secuencia
     * e-NCF, los demás siguen. Idempotente.
     */
    async generarReemplazos(): Promise<ResumenReemplazos> {
        const pendientes = await this.pendientesReemplazo();
        const resumen: ResumenReemplazos = { creados: 0, errores: [] };
        if (pendientes.length === 0) return resumen;

        const settings = await AppDataSource.getRepository(Setting).findOneBy({ id: 1 });
        const rncEmisor = normalizeRnc(settings?.business_tax_id ?? "");

        for (const p of pendientes) {
            try {
                await AppDataSource.transaction(async (manager) => {
                    const venta = await manager.findOneBy(Sale, { id: p.sale_id });
                    if (!venta) throw new Error(`la venta ${p.sale_id} ya no existe`);

                    const tipoEcf = EQUIVALENTE_ECF[p.tipo];
                    // e-NCF real aunque haya otra contingencia abierta: el
                    // reemplazo es un e-CF por definición.
                    const encf = await fiscalService.assignNcf(manager, tipoEcf);

                    let monto = Number(venta.total_amount);
                    let itbis = Number(venta.itbis_amount ?? 0);
                    if (p.origen === "devolucion") {
                        const dev = await manager.findOneBy(SaleReturn, { credit_note_ncf: p.ncf });
                        monto = Number(dev?.total_refunded ?? p.monto);
                        itbis = Number(dev?.itbis_refunded ?? 0);
                    }

                    await ecfService.registrarDraft(manager, {
                        sale_id: venta.id,
                        tipo: Number(tipoEcf) as 31 | 32 | 34,
                        encf,
                        rnc_emisor: rncEmisor,
                        rnc_comprador: venta.fiscal_customer_rnc,
                        nombre_comprador: venta.fiscal_customer_name ?? venta.customer_name,
                        monto_total: monto,
                        itbis_total: itbis,
                        fecha_emision: formatoFecha(new Date()),
                        ncf_reemplazado: p.ncf,
                        fecha_ncf_reemplazado: formatoFecha(new Date(p.fecha)),
                    });
                });
                resumen.creados += 1;
            } catch (err) {
                resumen.errores.push(`${p.ncf}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        return resumen;
    }
}

export const contingenciaService = new ContingenciaService();
