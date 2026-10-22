import { AppDataSource } from "@main/config/data-source";
import { EntityManager, IsNull } from "typeorm";
import { NcfSequence } from "@main/modules/fiscal/entities/ncf-sequence.entity";
import { EcfContingencia } from "@main/modules/ecf/entities/ecf-contingencia.entity";
import { round2 } from "@shared/money";

/** Tipos de e-CF que emite Venilu. */
export type NcfType = '31' | '32' | '34';

/**
 * Comprobantes NO electrónicos (serie B), solo para la contingencia por
 * imposibilidad técnica (Informe Técnico §19.2: "el contribuyente deberá
 * disponer de secuencias autorizadas de Comprobantes Fiscales No
 * Electrónicos").
 */
export type NcfTipoPapel = 'B01' | 'B02' | 'B04';

export type TipoSecuencia = NcfType | NcfTipoPapel;

export const NCF_TYPE_LABELS: Record<TipoSecuencia, string> = {
    '31': 'Factura de Crédito Fiscal Electrónica',
    '32': 'Factura de Consumo Electrónica',
    '34': 'Nota de Crédito Electrónica',
    B01: 'Factura de Crédito Fiscal (contingencia)',
    B02: 'Factura de Consumo (contingencia)',
    B04: 'Nota de Crédito (contingencia)',
};

/**
 * Equivalencia e-CF ↔ serie B por la denominación del comprobante
 * (`docs/fec/REQUISITOS.md` §5.7, supuesto pendiente de confirmar).
 * "El tipo de e-CF emitido deberá corresponder al tipo equivalente del
 *  comprobante no electrónico que se reemplaza." — Informe Técnico §19.2.3.
 */
export const EQUIVALENTE_PAPEL: Record<NcfType, NcfTipoPapel> = { '31': 'B01', '32': 'B02', '34': 'B04' };
export const EQUIVALENTE_ECF: Record<NcfTipoPapel, NcfType> = { B01: '31', B02: '32', B04: '34' };

export function esTipoPapel(tipo: string | null | undefined): tipo is NcfTipoPapel {
    return tipo === 'B01' || tipo === 'B02' || tipo === 'B04';
}

/** Tipo de un NCF por su prefijo: `E31…` → '31', `B02…` → 'B02'. */
export function tipoDeNcf(ncf: string | null | undefined): TipoSecuencia | null {
    const v = String(ncf ?? '');
    if (/^E3[124]\d{10}$/.test(v)) return v.slice(1, 3) as NcfType;
    if (/^B0[124]\d{8}$/.test(v)) return v.slice(0, 3) as NcfTipoPapel;
    return null;
}

/**
 * e-NCF de 13 posiciones: `E` (serie) + 2 dígitos del tipo + 10 secuenciales.
 *
 * "La secuencia del comprobante fiscal electrónico dispone de una estructura
 *  de trece (13) posiciones alfanuméricas. La letra E corresponde a la serie
 *  del e-CF, los dos dígitos siguientes identifican el tipo de e-CF y los
 *  últimos diez corresponden al secuencial."
 *  — Informe Técnico e-CF, sección 7 (ver `docs/fec/REQUISITOS.md` §4.6).
 *
 * p. ej. tipo 32 con secuencia 143 → "E320000000143".
 */
export function formatNcf(type: TipoSecuencia, sequence: number): string {
    // Serie B: letra + 2 dígitos de tipo + 8 secuenciales = 11 posiciones
    // (Informe Técnico §18.2.1-A, nota 44: "serie 'B' con once (11) dígitos").
    if (esTipoPapel(type)) return `${type}${String(sequence).padStart(8, '0')}`;
    return `E${type}${String(sequence).padStart(10, '0')}`;
}

/** RNC (9 dígitos) o cédula (11 dígitos), solo números. */
export function isValidRncOrCedula(value: string): boolean {
    const digits = String(value ?? '').replace(/[-\s]/g, '');
    return /^\d{9}$/.test(digits) || /^\d{11}$/.test(digits);
}

export function normalizeRnc(value: string): string {
    return String(value ?? '').replace(/[-\s]/g, '');
}

/**
 * ITBIS incluido en un precio de venta (los precios dominicanos de mostrador
 * YA incluyen el impuesto): itbis = precio * tasa / (100 + tasa).
 */
export function itbisIncludedIn(amount: number, ratePercent: number): number {
    const rate = Number(ratePercent) || 0;
    if (rate <= 0) return 0;
    return round2((Number(amount) || 0) * rate / (100 + rate));
}

export interface SequenceStatus {
    id: string;
    type: TipoSecuencia;
    from_number: number;
    to_number: number;
    next_number: number;
    expires_at?: string | null;
    active: boolean;
    remaining: number;
    expired: boolean;
}

export class FiscalService {

    private isExpired(seq: NcfSequence, now = new Date()): boolean {
        if (!seq.expires_at) return false;
        return now > new Date(`${seq.expires_at}T23:59:59`);
    }

    /**
     * Asigna el próximo e-NCF del tipo dado DENTRO de la transacción de la
     * venta: si la venta falla, el número no se consume. Lanza errores
     * accionables en español cuando no hay secuencia utilizable.
     */
    async assignNcf(manager: EntityManager, type: TipoSecuencia): Promise<string> {
        const sequences = await manager.find(NcfSequence, {
            where: { type, active: true },
            order: { from_number: 'ASC' },
        });

        const usable = sequences.find(s => !this.isExpired(s) && s.next_number <= s.to_number);
        if (!usable) {
            const label = NCF_TYPE_LABELS[type];
            if (sequences.length === 0) {
                throw new Error(`No hay una secuencia de e-NCF ${type} (${label}) configurada. Configúrala en Ajustes → Fiscal.`);
            }
            if (sequences.some(s => this.isExpired(s) && s.next_number <= s.to_number)) {
                throw new Error(`La secuencia de e-NCF ${type} está VENCIDA. Solicita una nueva autorización a la DGII y actualízala en Ajustes → Fiscal.`);
            }
            throw new Error(`La secuencia de e-NCF ${type} se AGOTÓ. Solicita un nuevo rango a la DGII y regístralo en Ajustes → Fiscal.`);
        }

        // Números anulados ante la DGII (ANECF) no se vuelven a usar.
        let siguiente = usable.next_number;
        if (!esTipoPapel(type)) {
            siguiente = await this.saltarAnulados(manager, type, siguiente, usable.to_number);
            if (siguiente > usable.to_number) {
                usable.next_number = siguiente;
                await manager.save(NcfSequence, usable);
                return this.assignNcf(manager, type);
            }
        }

        const ncf = formatNcf(type, siguiente);
        usable.next_number = siguiente + 1;
        await manager.save(NcfSequence, usable);
        return ncf;
    }

    /**
     * Si `n` cae dentro de un rango anulado (ANECF no rechazado), devuelve el
     * primer número libre después de él.
     */
    private async saltarAnulados(manager: EntityManager, type: NcfType, n: number, tope: number): Promise<number> {
        const rangos: Array<{ desde: string; hasta: string }> = await manager.query(
            `SELECT "desde", "hasta" FROM "ecf_anulaciones" WHERE "tipo" = ? AND "estado" != 'rechazada'`,
            [Number(type)],
        );
        if (rangos.length === 0) return n;
        const tramos = rangos
            .map((r) => [Number(r.desde.slice(3)), Number(r.hasta.slice(3))] as const)
            .sort((a, b) => a[0] - b[0]);
        let actual = n;
        for (const [desde, hasta] of tramos) {
            if (actual > tope) break;
            if (actual >= desde && actual <= hasta) actual = hasta + 1;
        }
        return actual;
    }

    /** Contingencia por imposibilidad técnica abierta (o `null`). */
    async contingenciaAbierta(manager: EntityManager = AppDataSource.manager): Promise<EcfContingencia | null> {
        return manager.findOne(EcfContingencia, { where: { hasta: IsNull() }, order: { desde: 'DESC' } });
    }

    /**
     * Numera el comprobante de una operación. En operación normal asigna el
     * e-NCF del tipo pedido; durante una contingencia por imposibilidad
     * técnica, el NCF de la serie B equivalente (Informe Técnico §19.2.1:
     * "Emitir y entregar al receptor comprobantes fiscales no electrónicos").
     */
    async assignComprobante(manager: EntityManager, type: NcfType): Promise<{ ncf: string; tipo: TipoSecuencia }> {
        if (await this.contingenciaAbierta(manager)) {
            const papel = EQUIVALENTE_PAPEL[type];
            try {
                return { ncf: await this.assignNcf(manager, papel), tipo: papel };
            } catch (err) {
                const detalle = err instanceof Error ? err.message : String(err);
                throw new Error(
                    `Hay una contingencia de facturación electrónica activa y se necesita un NCF ${papel}: ${detalle}`
                );
            }
        }
        return { ncf: await this.assignNcf(manager, type), tipo: type };
    }

    // ─── Gestión de secuencias (Ajustes → Fiscal) ────────────────────────────

    async listSequences(): Promise<SequenceStatus[]> {
        const rows = await AppDataSource.getRepository(NcfSequence).find({
            order: { type: 'ASC', from_number: 'ASC' },
        });
        return rows.map(s => ({
            id: s.id,
            type: s.type,
            from_number: s.from_number,
            to_number: s.to_number,
            next_number: s.next_number,
            expires_at: s.expires_at ?? null,
            active: !!s.active,
            remaining: Math.max(0, s.to_number - s.next_number + 1),
            expired: this.isExpired(s),
        }));
    }

    async saveSequence(data: {
        id?: string;
        type: TipoSecuencia;
        from_number: number;
        to_number: number;
        next_number?: number;
        expires_at?: string | null;
        active?: boolean;
    }): Promise<NcfSequence> {
        if (!['31', '32', '34', 'B01', 'B02', 'B04'].includes(data.type)) {
            throw new Error('Tipo de comprobante inválido');
        }
        const from = Number(data.from_number);
        const to = Number(data.to_number);
        // e-NCF: 10 dígitos secuenciales · serie B: 8.
        const maximo = esTipoPapel(data.type) ? 99_999_999 : 9_999_999_999;
        const digitos = esTipoPapel(data.type) ? 8 : 10;
        if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > maximo) {
            throw new Error(`Rango de secuencia inválido (desde ≤ hasta, máximo ${digitos} dígitos)`);
        }
        let next = data.next_number === undefined ? from : Number(data.next_number);
        if (!Number.isInteger(next) || next < from) next = from;
        if (data.expires_at != null && data.expires_at !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(data.expires_at)) {
            throw new Error('La fecha de vencimiento debe tener formato YYYY-MM-DD');
        }
        // El XSD del e-CF 31 exige <FechaVencimientoSecuencia> en IdDoc, así
        // que una secuencia de Crédito Fiscal no puede guardarse sin ella.
        if (data.type === '31' && !data.expires_at) {
            throw new Error('El e-CF 31 (Crédito Fiscal) exige registrar la fecha de vencimiento de la secuencia.');
        }

        const repo = AppDataSource.getRepository(NcfSequence);

        // Un rango autorizado por la DGII es único: dos secuencias del mismo
        // tipo NO pueden solaparse (se emitirían NCF duplicados al agotarse
        // la primera). Se valida contra todas las del tipo, activas o no.
        const siblings = await repo.find({ where: { type: data.type } });
        const clash = siblings.find(s =>
            s.id !== data.id && from <= s.to_number && to >= s.from_number
        );
        if (clash) {
            throw new Error(
                `El rango ${from}–${to} se solapa con la secuencia ${data.type} ${clash.from_number}–${clash.to_number}` +
                ` (${clash.active ? 'activa' : 'inactiva'}). Edita o elimina esa secuencia primero.`
            );
        }

        if (data.id) {
            const existing = await repo.findOneBy({ id: data.id });
            if (!existing) throw new Error('Secuencia no encontrada');
            // Nunca retroceder el contador por debajo de lo ya emitido
            if (next < existing.next_number && from <= existing.from_number) {
                next = existing.next_number;
            }
            repo.merge(existing, {
                type: data.type, from_number: from, to_number: to,
                next_number: next,
                expires_at: data.expires_at || undefined,
                active: data.active ?? existing.active,
            });
            return repo.save(existing);
        }

        return repo.save(repo.create({
            type: data.type, from_number: from, to_number: to, next_number: next,
            expires_at: data.expires_at || undefined,
            active: data.active ?? true,
        }));
    }

    async deleteSequence(id: string): Promise<void> {
        const repo = AppDataSource.getRepository(NcfSequence);
        const seq = await repo.findOneBy({ id });
        if (!seq) throw new Error('Secuencia no encontrada');
        // Si ya emitió números, desactivar en vez de borrar (trazabilidad)
        if (seq.next_number > seq.from_number) {
            seq.active = false;
            await repo.save(seq);
            return;
        }
        await repo.delete({ id });
    }
}

export const fiscalService = new FiscalService();
