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

    async getNextNcf(ncfType: NcfType): Promise<string> {
        const now = new Date();
        const seq = await this.repository.findOne({
            where: { ncf_type: ncfType, active: true },
        });
        if (!seq) throw new Error(`No hay secuencia activa para tipo ${ncfType}`);

        if (seq.valid_from && new Date(seq.valid_from) > now) {
            throw new Error(`La secuencia ${ncfType} aún no está vigente (válida desde ${seq.valid_from.toISOString().split('T')[0]})`);
        }

        if (seq.valid_to && new Date(seq.valid_to) < now) {
            throw new Error(`La secuencia ${ncfType} ha vencido (válida hasta ${seq.valid_to.toISOString().split('T')[0]})`);
        }

        const current = parseInt(seq.current_number, 10);
        const final = parseInt(seq.final_number, 10);

        if (current > final) throw new Error(`Secuencia ${ncfType} agotada`);

        const next = String(current).padStart(8, "0");
        seq.current_number = String(current + 1).padStart(8, "0");
        await this.repository.save(seq);

        return `${seq.branch_code}${ncfType}${next}`;
    }
}
