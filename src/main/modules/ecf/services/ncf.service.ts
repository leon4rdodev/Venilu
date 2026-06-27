import { AppDataSource } from "@main/config/data-source";
import { NcfSequence, NcfType } from "@main/modules/ecf/entities/ncf-sequence.entity";
import { Repository } from "typeorm";

export class NcfService {
    private repository: Repository<NcfSequence>;

    constructor() {
        this.repository = AppDataSource.getRepository(NcfSequence);
    }

    async findAll(): Promise<NcfSequence[]> {
        return this.repository.find({ order: { ncf_type: "ASC", branch_code: "ASC" } });
    }

    async findOne(id: string): Promise<NcfSequence | null> {
        return this.repository.findOneBy({ id });
    }

    async create(data: Partial<NcfSequence>): Promise<NcfSequence> {
        const seq = this.repository.create(data);
        return this.repository.save(seq);
    }

    async update(id: string, data: Partial<NcfSequence>): Promise<NcfSequence> {
        const seq = await this.findOne(id);
        if (!seq) throw new Error("Secuencia NCF no encontrada");
        this.repository.merge(seq, data);
        return this.repository.save(seq);
    }

    async delete(id: string): Promise<void> {
        const result = await this.repository.delete(id);
        if (result.affected === 0) throw new Error("Secuencia NCF no encontrada");
    }

    async getNextNcf(
        ncfType: NcfType,
        ncfSequenceRepo?: Repository<NcfSequence>
    ): Promise<string> {
        const repo = ncfSequenceRepo || this.repository;
        const now = new Date();

        // First validate the sequence exists and is within validity period
        const seq = await repo.findOne({
            where: { ncf_type: ncfType, active: true },
        });
        if (!seq) throw new Error(`No hay secuencia activa para tipo ${ncfType}`);

        if (seq.valid_from && new Date(seq.valid_from) > now) {
            throw new Error(`La secuencia ${ncfType} aún no está vigente (válida desde ${seq.valid_from.toISOString().split('T')[0]})`);
        }
        if (seq.valid_to && new Date(seq.valid_to) < now) {
            throw new Error(`La secuencia ${ncfType} ha vencido (válida hasta ${seq.valid_to.toISOString().split('T')[0]})`);
        }

        // Atomic increment: advance the counter in a single SQL statement.
        // This avoids race conditions where two callers read the same current_number.
        // The WHERE clause ensures we only increment if the sequence isn't exhausted.
        const currentNum = parseInt(seq.current_number, 10);
        if (isNaN(currentNum)) {
            throw new Error(`Secuencia ${ncfType} tiene un valor inválido: ${seq.current_number}`);
        }

        const finalNum = parseInt(seq.final_number, 10);
        if (isNaN(finalNum)) {
            throw new Error(`Secuencia ${ncfType} tiene un valor final inválido: ${seq.final_number}`);
        }

        if (currentNum > finalNum) {
            throw new Error(`Secuencia ${ncfType} agotada`);
        }

        const nextNum = currentNum + 1;
        const nextPadded = String(nextNum).padStart(8, "0");

        // Atomically update — if two callers read the same current_number,
        // only the first UPDATE will match. The second will affect 0 rows
        // because current_number no longer matches.
        const updateResult = await repo.update(
            { ncf_type: ncfType, active: true, current_number: seq.current_number },
            { current_number: nextPadded }
        );

        if (updateResult.affected === 0) {
            // Another caller already consumed this NCF — retry once
            return this.getNextNcf(ncfType, repo);
        }

        const ncfNumber = String(currentNum).padStart(8, "0");
        return `${seq.branch_code}${ncfType}${ncfNumber}`;
    }
}
