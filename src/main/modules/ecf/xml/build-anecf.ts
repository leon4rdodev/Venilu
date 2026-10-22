import { getParsedSchema, getRootNode } from './xsd-model';
import { serializeRoot, type RawNode } from './render';

/**
 * **ANECF** — Anulación de secuencias de e-NCF (XSD oficial `ANECF v.1.0.xsd`).
 *
 * Fuente: *Formato Anulación de e-NCF v1.0* (DGII) — `docs/fec/REQUISITOS.md`
 * §4.20:
 *
 * > "El contribuyente podrá anular secuencias autorizadas de comprobantes
 * > fiscales electrónicos, si la factura emitida no ha sido enviada a la DGII
 * > ni al receptor o si la secuencia no ha sido utilizada […]. Si la factura
 * > fue enviada a la DGII y/o al receptor, el contribuyente anulará la
 * > secuencia emitiendo una Nota de Crédito Electrónica."
 *
 * Estructura:
 *
 *   <ANECF>
 *     <Encabezado>
 *       <Version>1.0</Version>
 *       <RncEmisor/>
 *       <CantidadeNCFAnulados/>        ∑ de todas las líneas
 *       <FechaHoraAnulacioneNCF/>      dd-MM-AAAA HH:mm:ss
 *     </Encabezado>
 *     <DetalleAnulacion>
 *       <Anulacion>                    1–10, una por tipo de e-CF
 *         <NoLinea/>                   1, 2, 3… (orden secuencial)
 *         <TipoeCF/>
 *         <TablaRangoSecuenciasAnuladaseNCF>
 *           <Secuencias><SecuenciaeNCFDesde/><SecuenciaeNCFHasta/></Secuencias>
 *         </TablaRangoSecuenciasAnuladaseNCF>
 *         <CantidadeNCFAnulados/>      ∑ de los rangos de la línea
 *       </Anulacion>
 *     </DetalleAnulacion>
 *     <!-- slot xs:any de la firma -->
 *   </ANECF>
 */

export interface RangoAnulado {
    /** e-NCF inicial (13 posiciones), p. ej. `E320000000101`. */
    desde: string;
    /** e-NCF final, misma serie y tipo; ≥ `desde`. */
    hasta: string;
}

export interface LineaAnulacion {
    tipo: 31 | 32 | 34;
    rangos: RangoAnulado[];
}

export interface BuildAnecfInput {
    rncEmisor: string;
    /** `dd-MM-yyyy HH:mm:ss` (GMT-4). */
    fechaHora: string;
    lineas: LineaAnulacion[];
}

/** Estructura del e-NCF (Formato ANECF, nota 1): serie E–Z salvo P, 2 de tipo, 10 de secuencial. */
const ENCF = /^([E-OQ-Z])(\d{2})(\d{10})$/;

/** Cantidad de e-NCF de un rango (incluye ambos extremos). */
export function cantidadRango(r: RangoAnulado): number {
    return Number(r.hasta.slice(3)) - Number(r.desde.slice(3)) + 1;
}

/**
 * Valida un rango con las reglas del Formato ANECF (campos 3 y 4 del detalle):
 * estructura de 13 posiciones, serie entre E–Z (salvo P), tipo igual al de la
 * línea, misma serie y tipo en ambos extremos, `desde ≤ hasta`, ambos > 0.
 */
export function validarRango(tipo: number, r: RangoAnulado): void {
    const d = ENCF.exec(r.desde);
    const h = ENCF.exec(r.hasta);
    if (!d) throw new Error(`"${r.desde}" no es un e-NCF válido (13 posiciones, p. ej. E310000000001).`);
    if (!h) throw new Error(`"${r.hasta}" no es un e-NCF válido (13 posiciones, p. ej. E310000000001).`);
    if (Number(d[2]) !== tipo) throw new Error(`${r.desde} no es del tipo ${tipo}.`);
    if (d[1] !== h[1] || d[2] !== h[2]) {
        throw new Error(`${r.desde} y ${r.hasta} deben tener la misma serie y tipo de comprobante.`);
    }
    const desde = Number(d[3]);
    const hasta = Number(h[3]);
    if (desde <= 0 || hasta <= 0) throw new Error('Las secuencias deben ser mayores a cero.');
    if (desde > hasta) {
        throw new Error(
            `El valor del campo SecuenciaeNCFDesde (${r.desde}) es mayor al del campo SecuenciaeNCFHasta (${r.hasta}).`
        );
    }
}

export function buildAnecfXml(input: BuildAnecfInput): { xml: string; total: number } {
    if (input.lineas.length === 0) throw new Error('La anulación necesita al menos un rango.');
    if (input.lineas.length > 10) throw new Error('El formato ANECF admite hasta 10 líneas de anulación.');

    const tipos = new Set<number>();
    let total = 0;
    const anulaciones: RawNode[] = input.lineas.map((linea, i) => {
        if (tipos.has(linea.tipo)) {
            throw new Error(`El tipo ${linea.tipo} aparece en dos líneas: agrupe sus rangos en una sola.`);
        }
        tipos.add(linea.tipo);
        if (linea.rangos.length === 0) throw new Error(`La línea del tipo ${linea.tipo} no tiene rangos.`);
        if (linea.rangos.length > 10_000) throw new Error('Una línea admite hasta 10,000 rangos.');

        let cantidad = 0;
        for (const r of linea.rangos) {
            validarRango(linea.tipo, r);
            cantidad += cantidadRango(r);
        }
        total += cantidad;

        return {
            NoLinea: i + 1,
            TipoeCF: linea.tipo,
            TablaRangoSecuenciasAnuladaseNCF: {
                Secuencias: linea.rangos.map((r) => ({
                    SecuenciaeNCFDesde: r.desde,
                    SecuenciaeNCFHasta: r.hasta,
                })),
            },
            CantidadeNCFAnulados: cantidad,
        };
    });

    const root = getRootNode(getParsedSchema('anecf'));
    if (root.name !== 'ANECF') throw new Error(`El XSD ANECF tiene raíz "${root.name}", se esperaba "ANECF".`);

    const { xml, descartados } = serializeRoot(root, {
        Encabezado: {
            Version: '1.0',
            RncEmisor: input.rncEmisor,
            CantidadeNCFAnulados: total,
            FechaHoraAnulacioneNCF: input.fechaHora,
        },
        DetalleAnulacion: { Anulacion: anulaciones },
    });
    if (descartados.length > 0) {
        throw new Error(`El ANECF construido tiene tags fuera del XSD: ${descartados.join(', ')}`);
    }
    return { xml, total };
}
