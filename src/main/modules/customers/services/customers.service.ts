import { AppDataSource } from "@main/config/data-source";
import { Customer } from "@main/modules/customers/entities/customer.entity";
import { Sale } from "@main/modules/sales/entities/sale.entity";
import { DebtPayment } from "@main/modules/sales/entities/debt-payment.entity";
import { Repository, Like, Not } from "typeorm";

export class CustomersService {
    private customerRepository: Repository<Customer>;
    private saleRepository: Repository<Sale>;
    private debtPaymentRepository: Repository<DebtPayment>;

    constructor() {
        this.customerRepository = AppDataSource.getRepository(Customer);
        this.saleRepository = AppDataSource.getRepository(Sale);
        this.debtPaymentRepository = AppDataSource.getRepository(DebtPayment);
    }

    async findAll(): Promise<Customer[]> {
        return this.customerRepository.find({
            order: { name: "ASC" },
        });
    }

    async findOne(id: string): Promise<Customer | null> {
        return this.customerRepository.findOneBy({ id });
    }

    async search(query: string): Promise<Customer[]> {
        return this.customerRepository.find({
            where: [
                { name: Like(`%${query}%`) },
                { phone: Like(`%${query}%`) },
                { email: Like(`%${query}%`) },
            ],
            order: { name: "ASC" },
        });
    }

    async create(customerData: Partial<Customer>): Promise<Customer> {
        if (!customerData.name) {
            throw new Error("El nombre del cliente es requerido");
        }

        const newCustomer = this.customerRepository.create(customerData);
        return this.customerRepository.save(newCustomer);
    }

    async update(id: string, customerData: Partial<Customer>): Promise<Customer> {
        const customer = await this.findOne(id);
        if (!customer) {
            throw new Error("Cliente no encontrado");
        }

        this.customerRepository.merge(customer, customerData);
        return this.customerRepository.save(customer);
    }

    async delete(id: string): Promise<void> {
        const result = await this.customerRepository.delete(id);
        if (result.affected === 0) {
            throw new Error("Cliente no encontrado");
        }
    }

    async getStats(): Promise<{
        totalDebt: number;
        totalCustomers: number;
        newThisMonth: number;
        customersWithDebt: number;
        activeThisMonth: number;
    }> {
        const totalCustomers = await this.customerRepository.count();

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const newThisMonth = await this.customerRepository
            .createQueryBuilder("customer")
            .where("customer.created_at >= :startOfMonth", { startOfMonth })
            .getCount();

        const customersWithDebt = await this.customerRepository
            .createQueryBuilder("customer")
            .where("customer.balance > 0")
            .getCount();

        const debtResult = await this.customerRepository
            .createQueryBuilder("customer")
            .select("COALESCE(SUM(customer.balance), 0)", "total")
            .where("customer.balance > 0")
            .getRawOne<{ total: string }>();

        const totalDebt = parseFloat(debtResult?.total ?? "0");

        const activeResult = await this.saleRepository
            .createQueryBuilder("sale")
            .select("COUNT(DISTINCT sale.customer_id)", "count")
            .where("sale.customer_id IS NOT NULL")
            .andWhere("sale.status != :voidedStatus", { voidedStatus: 'voided' })
            .andWhere("sale.created_at >= :thirtyDaysAgo", { thirtyDaysAgo })
            .getRawOne<{ count: string }>();

        const activeThisMonth = parseInt(activeResult?.count ?? "0", 10);

        return { totalDebt, totalCustomers, newThisMonth, customersWithDebt, activeThisMonth };
    }

    async getCustomerSales(customerId: string, page: number = 1, limit: number = 20) {
        const [data, total] = await this.saleRepository.findAndCount({
            where: { customer_id: customerId },
            relations: ["items"],
            order: { created_at: "DESC" },
            take: limit,
            skip: (page - 1) * limit,
        });

        // Calculate total spent across ALL sales (not just this page)
        const totalSpentResult = await this.saleRepository
            .createQueryBuilder("sale")
            .select("SUM(sale.total_amount)", "total")
            .where("sale.customer_id = :customerId", { customerId })
            .andWhere("sale.status != :voided", { voided: 'voided' })
            .getRawOne();

        const totalValue = totalSpentResult && totalSpentResult.total ? parseFloat(totalSpentResult.total) : 0;

        return {
            data,
            total,
            totalSpent: totalValue,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        };
    }

    async getCustomerPayments(customerId: string, page: number = 1, limit: number = 20) {
        const [data, total] = await this.debtPaymentRepository.findAndCount({
            where: { customer_id: customerId },
            order: { created_at: "DESC" },
            take: limit,
            skip: (page - 1) * limit,
        });

        return {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        };
    }
}
