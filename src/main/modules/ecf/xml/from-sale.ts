import type { EcfRawNode } from './build-ecf';

/**
 * Mapeo **venta de Venilu → secciones del e-CF**.
 *
 * Cada regla que se aplica aquí está citada en `docs/fec/REQUISITOS.md` con
 * documento → sección → texto literal. Fuentes: `formato-ecf.pdf` (V1.0,
 * oct-2025) y `formato-rfce.pdf` (V1.0, oct-2025), ambas con sha256 en
 * `docs/fec/FUENTES.md`.
 *
 * ── Reglas aplicadas ────────────────────────────────────────────────────────
 *
 * [R1] `IndicadorMontoGravado` = 1
 *   "Valor 1 si los montos en las líneas sección B 'Detalle de Bienes o
 *    Servicios' se encuentran con ITBIS incluido."  — Formato e-CF, campo 7.
 *   Los precios de mostrador dominicanos de Venilu incluyen ITBIS, así que los
 *   `MontoItem` que se envían lo incluyen.
 *
 * [R2] `MontoItem` = PrecioUnitarioItem × Cantidad − MontoDescuento + MontoRecargo
 *   — Formato e-CF, campo "Monto Ítem".
 *
 * [R3] `MontoGravadoI1` (con IndicadorMontoGravado = 1)
 *   "Si el indicador monto gravado es =1, se debe dividir la suma de valores
 *    del monto ítem con indicador de facturación=1, entre (1+tasa ITBIS tasa
 *    1), menos descuentos más recargos."  — Formato e-CF, campo "Monto Gravado
 *    ITBIS Tasa 1", validación c).
 *   El descuento global de Venilu se prorratea por línea (se resta dentro de
 *   `MontoItem`), de modo que la "suma de montos ítem" ya viene neta.
 *
 * [R4] `MontoExento`
 *   "Suma de valores del monto ítem con indicador de facturación=4, menos
 *    descuentos más recargos." — Formato e-CF, campo "Monto Exento".
 *   (Sin división: los importes exentos no llevan ITBIS.)
 *
 * [R5] `TotalITBIS1 = MontoGravadoI1 × ITBIS tasa`
 *   "Valor numérico igual a Monto Gravado ITBIS Tasa1 por la Tasa ITBIS 1.
 *    b) Total ITBIS Tasa1= Monto Gravado ITBIS tasa1 *ITBIS tasa."
 *   — Formato e-CF, campo 101.
 *
 * [R6] `MontoTotal = MontoGravadoTotal + MontoExento + TotalITBIS
 *         + MontoImpuestoAdicional`
 *   — Formato e-CF, campo 110 "Monto Total".
 *
 * [R7] `MontoGravadoTotal = MontoGravadoI1 + MontoGravadoI2 + MontoGravadoI3`
 *
 * ── PENDIENTE (sección 5 de REQUISITOS.md) ─────────────────────────────────
 *
 * [P] Con reglas [R3] + [R5] + [R6] aplicadas con redondeo a 2 decimales,
 *     `<MontoTotal>` puede diferir en ≤ RD$0.01 de la suma de los `MontoItem`
 *     (p. ej. 10.00 → base 8.47 + ITBIS 1.52 = 9.99). Las tres reglas son
 *     literales y no todas pueden cuadrar a la vez con redondeos; se implementa
 *     tal cual la DGII las publica y se marca para confirmar en pre-
 *     certificación.
 */

/** Tipos de comprobante que emite Venilu (XSD `TipoeCFType`, comentario literal). */
export type EcfTipo = 31 | 32 | 34;

/** Línea de detalle ya prorrateada con el descuento global de la venta. */
export interface LineaVenta {
    nombre: string;
    descripcion?: string;
    /** Entero > 0 (`SaleItem.quantity` es columna entera). */
    cantidad: number;
    /** Precio unitario CON ITBIS incluido (`SaleItem.unit_price`). */
    precioUnitario: number;
    /** Total de la línea antes del descuento global (`SaleItem.total_price`). */
    montoLinea: number;
    /** `Product.itbis_exempt` — 4 Exento / 1-3 gravado según tasa. */
    exento: boolean;
}

export type MetodoPago = 'cash' | 'card' | 'transfer' | 'credit';

export interface EmisorEcf {
    rnc: string;
    razonSocial: string;
    direccion: string;
    telefono: string;
    nombreComercial?: string;
    municipio?: string;
    provincia?: string;
    correo?: string;
    actividadEconomica?: string;
}

export interface VentaEcf {
    tipo: EcfTipo;
    /** e-NCF de 13 posiciones (E + 2 dígitos de tipo + 10 secuenciales). */
    encf: string;
    /** Fecha de emisión (`dd-MM-yyyy`). */
    fechaEmision: string;
    /** Fecha/hora de firma (`dd-MM-yyyy HH:mm:ss`). */
    fechaHoraFirma: string;
    /** `FechaVencimientoSecuencia` (`dd-MM-yyyy`) — **obligatorio en tipo 31**. */
    vencimientoSecuencia?: string;
    emisor: EmisorEcf;
    compradorRnc?: string;
    compradorNombre?: string;
    /** Información de referencia — **obligatorio en tipo 34**. */
    referencia?: {
        encfModificado: string;
        fechaModificado: string;
        /** 1 Anula · 2 Corrige texto · 3 Corrige montos · 4 Reemplazo en
         *  contingencia · 5 Referencia a Factura de Consumo Electrónica. */
        codigoModificacion: number;
        razonModificacion?: string;
    };
    lineas: LineaVenta[];
    /** `Sale.discount_amount` — prorrateado por línea (ver [R3]). */
    descuentoGlobal: number;
    /** Tasa de ITBIS vigente: 18, 16 o 0. */
    tasaItbis: number;
    metodoPago: MetodoPago;
}

export interface VentaEcfMapeada {
    encabezado: EcfRawNode;
    detallesItems: EcfRawNode;
    seccionesRaiz: Record<string, EcfRawNode | undefined>;
    /** Totales reutilizables por el RFCE (mismos valores del e-CF). */
    totales: EcfRawNode;
    /** IdDoc del RFCE: TipoIngresos + TipoPago [+ TablaFormasPago]. */
    idDocRfce: EcfRawNode;
    /** `<MontoTotal>` con 2 decimales — literalmente igual al del QR. */
    montoTotal: string;
    /** `rfce` = resumen de Factura de Consumo < RD$250,000 (formato RFCE). */
    via: 'ecf' | 'rfce';
}

/** Tope de la Factura de Consumo Electrónica que va por RFCE. */
const TOPE_RFCE = 250_000;

/* ── helpers ─────────────────────────────────────────────────────────────── */

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

function hay(valor: string | undefined): string | undefined {
    const v = (valor ?? '').trim();
    return v.length > 0 ? v : undefined;
}

/**
 * `IndicadorFacturacion` de la línea (XSD `IndicadorFacturacionType`,
 * comentarios literales):
 *
 *   0 No Facturable (18%) · 1 ITBIS 1 (18%) · 2 ITBIS 2 (16%) ·
 *   3 ITBIS 3 (0%)  · 4 Exento (E)
 *
 * El 0 (no facturable) no aplica: toda línea de Venilu es facturable.
 */
function indicadorFacturacion(exento: boolean, tasa: number): number {
    if (exento) return 4;
    if (tasa === 18) return 1;
    if (tasa === 16) return 2;
    if (tasa === 0) return 3;
    throw new Error(
        `La tasa de ITBIS configurada (${tasa}%) no corresponde a ninguna tasa que ` +
        `la DGII admite en el e-CF: 18 (ITBIS 1), 16 (ITBIS 2) o 0 (ITBIS 3). ` +
        `Corrígela en Ajustes → Fiscal.`
    );
}

/** `FormaPago` (XSD `FormaPagoType`, comentarios literales de la DGII). */
const FORMA_PAGO: Record<MetodoPago, number> = {
    cash: 1,        // Efectivo
    card: 3,        // Tarjeta de Débito/Crédito
    transfer: 2,    // Cheque/Transferencia/Depósito
    credit: 4,      // Venta a Crédito
};

/** `TipoPago`: 1 Contado · 2 Crédito · 3 Gratuito (Formato e-CF, campo 9). */
function tipoPago(metodo: MetodoPago): number {
    return metodo === 'credit' ? 2 : 1;
}

/* ── mapeo ───────────────────────────────────────────────────────────────── */

export function mapearVenta(v: VentaEcf): VentaEcfMapeada {
    if (v.lineas.length === 0) {
        throw new Error('No se puede emitir un e-CF sin líneas de detalle.');
    }

    // ── Prorrateo del descuento global por línea ──────────────────────────
    const subtotalLineas = round2(v.lineas.reduce((s, l) => s + l.montoLinea, 0));
    const descuento = Math.min(Math.max(0, round2(v.descuentoGlobal)), subtotalLineas);

    let descAcumulado = 0;
    const descuentosPorLinea = v.lineas.map((l, i) => {
        if (descuento <= 0) return 0;
        let d: number;
        if (i === v.lineas.length - 1) {
            d = round2(descuento - descAcumulado);
        } else if (subtotalLineas > 0) {
            d = round2(descuento * (l.montoLinea / subtotalLineas));
        } else {
            d = 0;
        }
        d = Math.min(Math.max(0, d), l.montoLinea);
        descAcumulado = round2(descAcumulado + d);
        return d;
    });

    // ── MontoItem por línea [R2] + agrupación por indicador ───────────────
    const tasa = v.tasaItbis / 100;
    const porIndicador: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };

    const items: EcfRawNode[] = v.lineas.map((l, i) => {
        const indicador = indicadorFacturacion(l.exento, v.tasaItbis);
        const descuentoLinea = descuentosPorLinea[i];
        const montoItem = round2(l.montoLinea - descuentoLinea);
        porIndicador[indicador] = round2(porIndicador[indicador] + montoItem);

        return {
            NumeroLinea: i + 1,
            IndicadorFacturacion: indicador,
            NombreItem: l.nombre,
            IndicadorBienoServicio: 1, // 1 Bien · 2 Servicio (sin flag en catálogo)
            ...(hay(l.descripcion) ? { DescripcionItem: l.descripcion } : {}),
            CantidadItem: l.cantidad,
            PrecioUnitarioItem: l.precioUnitario,
            ...(descuentoLinea > 0 ? { MontoDescuentoItem: descuentoLinea } : {}),
            MontoItem: montoItem,
        };
    });

    // ── Totales [R3] [R4] [R5] [R6] [R7] ─────────────────────────────────
    const gravadoI1 = round2(porIndicador[1] / (1 + (v.tasaItbis === 18 ? tasa : 0.18)));
    const gravadoI2 = round2(porIndicador[2] / (1 + 0.16));
    const gravadoI3 = porIndicador[3]; // tasa 0 → dividir entre (1+0) no cambia nada
    const exento = round2(porIndicador[4]);

    const itbis1 = round2(gravadoI1 * (v.tasaItbis === 18 ? tasa : 0.18));
    const itbis2 = round2(gravadoI2 * 0.16);
    const itbis3 = 0;

    const gravadoTotal = round2(gravadoI1 + gravadoI2 + gravadoI3);
    const totalItbis = round2(itbis1 + itbis2 + itbis3);
    const montoTotalNum = round2(gravadoTotal + exento + totalItbis);
    const montoTotal = montoTotalNum.toFixed(2);

    const totales: EcfRawNode = {
        ...(gravadoTotal > 0 ? { MontoGravadoTotal: gravadoTotal } : {}),
        ...(gravadoI1 > 0 ? { MontoGravadoI1: gravadoI1 } : {}),
        ...(gravadoI2 > 0 ? { MontoGravadoI2: gravadoI2 } : {}),
        ...(gravadoI3 > 0 ? { MontoGravadoI3: gravadoI3 } : {}),
        ...(exento > 0 ? { MontoExento: exento } : {}),
        ...(gravadoI1 > 0 ? { ITBIS1: v.tasaItbis } : {}),
        ...(gravadoI2 > 0 ? { ITBIS2: 16 } : {}),
        ...(gravadoI3 > 0 ? { ITBIS3: 0 } : {}),
        ...(totalItbis > 0 ? { TotalITBIS: totalItbis } : {}),
        ...(itbis1 > 0 ? { TotalITBIS1: itbis1 } : {}),
        ...(itbis2 > 0 ? { TotalITBIS2: itbis2 } : {}),
        MontoTotal: montoTotal,
    };

    // ── IdDoc ─────────────────────────────────────────────────────────────
    const idDoc: EcfRawNode = {
        IndicadorMontoGravado: 1, // [R1]
        TipoIngresos: '01',       // Ingresos por operaciones (No financieros)
        TipoPago: tipoPago(v.metodoPago),
        ...(v.tipo === 31 && hay(v.vencimientoSecuencia)
            ? { FechaVencimientoSecuencia: v.vencimientoSecuencia }
            : {}),
        ...(v.tipo === 34
            ? {
                IndicadorNotaCredito: 0,
                // 0 = fecha de emisión del e-CF modificado ≤ 30 días calendario
                // (se recalcula abajo si supera los 30 días).
            }
            : {}),
        ...(v.tipo !== 34
            ? {
                TablaFormasPago: {
                    FormaDePago: {
                        FormaPago: FORMA_PAGO[v.metodoPago],
                        MontoPago: montoTotal,
                    },
                },
            }
            : {}),
    };

    // `IndicadorNotaCredito`: 0 si la fecha de emisión del e-CF modificado es
    // ≤ 30 días calendario, 1 si es > 30 (XSD `IndicadorNotaCreditoType`).
    if (v.tipo === 34 && v.referencia) {
        const dias = diasEntre(v.referencia.fechaModificado, v.fechaEmision);
        if (dias !== null && dias > 30) idDoc.IndicadorNotaCredito = 1;
    }

    // ── Emisor ────────────────────────────────────────────────────────────
    const emisor: EcfRawNode = {
        RNCEmisor: v.emisor.rnc,
        RazonSocialEmisor: v.emisor.razonSocial,
        ...(hay(v.emisor.nombreComercial) ? { NombreComercial: v.emisor.nombreComercial } : {}),
        DireccionEmisor: v.emisor.direccion,
        ...(hay(v.emisor.municipio) ? { Municipio: v.emisor.municipio } : {}),
        ...(hay(v.emisor.provincia) ? { Provincia: v.emisor.provincia } : {}),
        TablaTelefonoEmisor: { TelefonoEmisor: v.emisor.telefono },
        ...(hay(v.emisor.correo) ? { CorreoEmisor: v.emisor.correo } : {}),
        ...(hay(v.emisor.actividadEconomica)
            ? { ActividadEconomica: v.emisor.actividadEconomica }
            : {}),
        FechaEmision: v.fechaEmision,
    };

    // ── Comprador (contenedor obligatorio; el XSD admite sus hijos vacíos) ─
    const comprador: EcfRawNode = {
        ...(hay(v.compradorRnc) ? { RNCComprador: v.compradorRnc } : {}),
        ...(hay(v.compradorNombre) ? { RazonSocialComprador: v.compradorNombre } : {}),
    };

    const encabezado: EcfRawNode = {
        IdDoc: idDoc,
        Emisor: emisor,
        Comprador: comprador,
        Totales: totales,
    };

    // ── InformacionReferencia (raíz, obligatorio en tipo 34) ───────────────
    const seccionesRaiz: Record<string, EcfRawNode | undefined> = {};
    if (v.tipo === 34) {
        if (!v.referencia) {
            throw new Error('Un e-CF tipo 34 (Nota de Crédito) requiere InformacionReferencia.');
        }
        seccionesRaiz.InformacionReferencia = {
            NCFModificado: v.referencia.encfModificado,
            ...(hay(v.referencia.razonModificacion)
                ? { RazonModificacion: v.referencia.razonModificacion }
                : {}),
            FechaNCFModificado: v.referencia.fechaModificado,
            CodigoModificacion: v.referencia.codigoModificacion,
        };
    }

    return {
        encabezado,
        detallesItems: { Item: items },
        seccionesRaiz,
        totales,
        idDocRfce: {
            TipoIngresos: idDoc.TipoIngresos,
            TipoPago: idDoc.TipoPago,
            ...(v.tipo !== 34 ? { TablaFormasPago: idDoc.TablaFormasPago } : {}),
        },
        montoTotal,
        via: v.tipo === 32 && montoTotalNum < TOPE_RFCE ? 'rfce' : 'ecf',
    };
}

/** Días de diferencia entre dos fechas `dd-MM-yyyy`; `null` si alguna es inválida. */
function diasEntre(desde: string, hasta: string): number | null {
    const a = parseFecha(desde);
    const b = parseFecha(hasta);
    if (!a || !b) return null;
    return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function parseFecha(valor: string): Date | null {
    const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(valor.trim());
    if (!m) return null;
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return Number.isNaN(d.getTime()) ? null : d;
}
