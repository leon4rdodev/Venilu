import { AppDataSource } from "@main/config/data-source";
import { EcDocument, EcType, EcStatus } from "@main/modules/ecf/entities/ecf-document.entity";
import { NcfService } from "@main/modules/ecf/services/ncf.service";
import { Customer } from "@main/modules/customers/entities/customer.entity";
import { Sale } from "@main/modules/sales/entities/sale.entity";
import { SaleItem } from "@main/modules/sales/entities/sale-item.entity";
import { Repository } from "typeorm";
import { randomUUID } from "crypto";

export class EcService {
    private repository: Repository<EcDocument>;
    private saleRepository: Repository<Sale>;
    private saleItemRepository: Repository<SaleItem>;
    private customerRepository: Repository<Customer>;
    private ncfService: NcfService;

    private readonly ITBIS_RATE = 0.18;

    constructor() {
        this.repository = AppDataSource.getRepository(EcDocument);
        this.saleRepository = AppDataSource.getRepository(Sale);
        this.saleItemRepository = AppDataSource.getRepository(SaleItem);
        this.customerRepository = AppDataSource.getRepository(Customer);
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
        const sale = await this.saleRepository.findOne({
            where: { id: saleId },
            relations: ["items", "customer"],
        });
        if (!sale) throw new Error("Venta no encontrada");

        const ncf = await this.ncfService.getNextNcf(ecfType);
        const itbisTotal = sale.total_amount * this.ITBIS_RATE;

        let customerName: string | undefined;
        let customerRnc: string | undefined;

        if (customerId) {
            const customer = await this.customerRepository.findOneBy({ id: customerId });
            if (customer) {
                customerName = customer.business_name || customer.name;
                customerRnc = customer.rnc;
            }
        }

        const doc = this.repository.create({
            ecf_id: randomUUID(),
            ecf_type: ecfType,
            ncf,
            customer_id: customerId,
            customer_name: customerName || sale.customer_name,
            customer_rnc: customerRnc,
            sale_id: saleId,
            total_amount: sale.total_amount,
            itbis_total: itbisTotal,
            status: "pending",
        });

        return this.repository.save(doc);
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
        const all = await this.repository.find();
        return {
            total: all.length,
            authorized: all.filter((d) => d.status === "authorized").length,
            pending: all.filter((d) => d.status === "pending" || d.status === "sent").length,
            rejected: all.filter((d) => d.status === "rejected").length,
            voided: all.filter((d) => d.status === "voided").length,
        };
    }
}
