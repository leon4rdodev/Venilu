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

        const seq = await repo
            .createQueryBuilder("seq")
            .setLock("pessimistic_write")
            .where("seq.ncf_type = :ncfType AND seq.active = :active", { ncfType, active: true })
            .getOne();

        if (!seq) throw new Error(`No hay secuencia activa para tipo ${ncfType}`);

        if (seq.valid_from && new Date(seq.valid_from) > now) {
            throw new Error(`La secuencia ${ncfType} aún no está vigente (válida desde ${seq.valid_from.toISOString().split('T')[0]})`);
        }
        if (seq.valid_to && new Date(seq.valid_to) < now) {
            throw new Error(`La secuencia ${ncfType} ha vencido (válida hasta ${seq.valid_to.toISOString().split('T')[0]})`);
        }

        const currentNum = parseInt(seq.current_number, 10);
        const finalNum = parseInt(seq.final_number, 10);

        if (isNaN(currentNum) || isNaN(finalNum)) {
            throw new Error(`Secuencia NCF corrupta: números no válidos`);
        }

        if (currentNum > finalNum) {
            throw new Error(`Secuencia ${ncfType} agotada`);
        }

        const remaining = finalNum - currentNum;
        if (remaining <= 50) {
            console.warn(`ALERTA: Secuencia ${ncfType} próxima a agotarse (${remaining} restantes)`);
        }

        const nextNum = currentNum + 1;
        const nextPadded = String(nextNum).padStart(8, "0");

        const updateResult = await repo.update(
            { ncf_type: ncfType, active: true, current_number: seq.current_number },
            { current_number: nextPadded }
        );

        if (updateResult.affected === 0) {
            return this.getNextNcf(ncfType, repo);
        }

        const ncfNumber = String(currentNum).padStart(8, "0");
        return `${seq.branch_code}${ncfType}${ncfNumber}`;
    }
}
