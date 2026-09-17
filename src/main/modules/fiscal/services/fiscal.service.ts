import { AppDataSource } from "@main/config/data-source";
import { EntityManager } from "typeorm";
import { NcfSequence } from "@main/modules/fiscal/entities/ncf-sequence.entity";
import { round2 } from "@shared/money";

export type NcfType = 'B01' | 'B02' | 'B04';

export const NCF_TYPE_LABELS: Record<NcfType, string> = {
    B01: 'Factura de Crédito Fiscal',
    B02: 'Factura de Consumo',
    B04: 'Nota de Crédito',
};

/** "B02" + 143 → "B0200000143" (tipo + secuencia de 8 dígitos). */
export function formatNcf(type: NcfType, sequence: number): string {
    return `${type}${String(sequence).padStart(8, '0')}`;
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
    type: NcfType;
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
     * Asigna el próximo NCF del tipo dado DENTRO de la transacción de la venta:
     * si la venta falla, el número no se consume. Lanza errores accionables en
     * español cuando no hay secuencia utilizable.
     */
    async assignNcf(manager: EntityManager, type: NcfType): Promise<string> {
        const sequences = await manager.find(NcfSequence, {
            where: { type, active: true },
            order: { from_number: 'ASC' },
        });

        const usable = sequences.find(s => !this.isExpired(s) && s.next_number <= s.to_number);
        if (!usable) {
            const label = NCF_TYPE_LABELS[type];
            if (sequences.length === 0) {
                throw new Error(`No hay una secuencia de NCF ${type} (${label}) configurada. Configúrala en Ajustes → Fiscal.`);
            }
            if (sequences.some(s => this.isExpired(s) && s.next_number <= s.to_number)) {
                throw new Error(`La secuencia de NCF ${type} está VENCIDA. Solicita una nueva autorización a la DGII y actualízala en Ajustes → Fiscal.`);
            }
            throw new Error(`La secuencia de NCF ${type} se AGOTÓ. Solicita un nuevo rango a la DGII y regístralo en Ajustes → Fiscal.`);
        }

        const ncf = formatNcf(type, usable.next_number);
        usable.next_number += 1;
        await manager.save(NcfSequence, usable);
        return ncf;
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
        type: NcfType;
        from_number: number;
        to_number: number;
        next_number?: number;
        expires_at?: string | null;
        active?: boolean;
    }): Promise<NcfSequence> {
        if (!['B01', 'B02', 'B04'].includes(data.type)) {
            throw new Error('Tipo de NCF inválido');
        }
        const from = Number(data.from_number);
        const to = Number(data.to_number);
        if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > 99_999_999) {
            throw new Error('Rango de secuencia inválido (desde ≤ hasta, máximo 8 dígitos)');
        }
        let next = data.next_number === undefined ? from : Number(data.next_number);
        if (!Number.isInteger(next) || next < from) next = from;
        if (data.expires_at != null && data.expires_at !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(data.expires_at)) {
            throw new Error('La fecha de vencimiento debe tener formato YYYY-MM-DD');
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
