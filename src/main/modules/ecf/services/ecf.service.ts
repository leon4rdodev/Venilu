import { AppDataSource } from "@main/config/data-source";
import { EcDocument, EcType, EcStatus } from "@main/modules/ecf/entities/ecf-document.entity";
import { NcfService } from "@main/modules/ecf/services/ncf.service";
import { NcfSequence } from "@main/modules/ecf/entities/ncf-sequence.entity";
import { Customer } from "@main/modules/customers/entities/customer.entity";
import { Sale } from "@main/modules/sales/entities/sale.entity";
import { Repository } from "typeorm";

export class EcService {
    private repository: Repository<EcDocument>;
    private ncfService: NcfService;

    constructor() {
        this.repository = AppDataSource.getRepository(EcDocument);
        this.ncfService = new NcfService();
    }

    async findAll(): Promise<EcDocument[]> {
        return this.repository.find({
            order: { created_at: "DESC" },
            relations: ["customer"],
        });
    }

    async findOne(id: string): Promise<EcDocument | null> {
        return this.repository.findOne({
            where: { id },
            relations: ["customer"],
        });
    }

    async findBySaleId(saleId: string): Promise<EcDocument | null> {
        return this.repository.findOneBy({ sale_id: saleId });
    }

    async generateFromSale(
        saleId: string,
        ecfType: EcType,
        customerId?: string
    ): Promise<EcDocument> {
        const existing = await this.repository.findOneBy({ sale_id: saleId });
        if (existing) throw new Error("Esta venta ya tiene un documento e-CF generado");

        return await AppDataSource.transaction(async (manager) => {
            const sale = await manager.findOne(Sale, {
                where: { id: saleId },
                relations: ["items", "customer"],
            });
            if (!sale) throw new Error("Venta no encontrada");

            const ncfSequenceRepo = manager.getRepository(NcfSequence);
            const ncf = await new NcfService().getNextNcf(ecfType, ncfSequenceRepo);

            let customerName: string | undefined;
            let customerRnc: string | undefined;

            if (customerId) {
                const customer = await manager.findOne(Customer, { where: { id: customerId } });
                if (customer) {
                    customerName = customer.business_name || customer.name;
                    customerRnc = customer.rnc;
                }
            }

            const doc = manager.getRepository(EcDocument).create({
                ecf_type: ecfType,
                ncf,
                customer_id: customerId,
                customer_name: customerName || sale.customer_name,
                customer_rnc: customerRnc,
                sale_id: saleId,
                total_amount: sale.total_amount,
                itbis_total: Number(sale.itbis_total) || 0,
                status: "pending",
            });

            return manager.getRepository(EcDocument).save(doc);
        });
    }

    async markSent(id: string): Promise<EcDocument> {
        const doc = await this.findOne(id);
        if (!doc) throw new Error("Documento e-CF no encontrado");
        doc.status = "sent";
        doc.sent_at = new Date();
        return this.repository.save(doc);
    }

    async markAuthorized(
        id: string,
        authorizationCode: string,
        responseXml: string
    ): Promise<EcDocument> {
        const doc = await this.findOne(id);
        if (!doc) throw new Error("Documento e-CF no encontrado");
        doc.status = "authorized";
        doc.authorization_code = authorizationCode;
        doc.response_xml = responseXml;
        doc.authorized_at = new Date();
        return this.repository.save(doc);
    }

    async markRejected(id: string, responseXml: string): Promise<EcDocument> {
        const doc = await this.findOne(id);
        if (!doc) throw new Error("Documento e-CF no encontrado");
        doc.status = "rejected";
        doc.response_xml = responseXml;
        return this.repository.save(doc);
    }

    async voidDocument(id: string): Promise<EcDocument> {
        const doc = await this.findOne(id);
        if (!doc) throw new Error("Documento e-CF no encontrado");
        if (doc.status === "voided") throw new Error("Documento ya anulado");
        doc.status = "voided";
        return this.repository.save(doc);
    }

    async getStats(): Promise<{
        total: number;
        authorized: number;
        pending: number;
        rejected: number;
        voided: number;
    }> {
        const [total, authorized, pending, rejected, voided] = await Promise.all([
            this.repository.count(),
            this.repository.count({ where: { status: "authorized" } }),
            this.repository.count({ where: [{ status: "pending" }, { status: "sent" }] }),
            this.repository.count({ where: { status: "rejected" } }),
            this.repository.count({ where: { status: "voided" } }),
        ]);
        return { total, authorized, pending, rejected, voided };
    }
}
