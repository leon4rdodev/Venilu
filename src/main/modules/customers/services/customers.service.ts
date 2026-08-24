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

    /**
     * Mature server-side customer list: paginated + filtered + sorted, with
     * per-customer purchase aggregates (count, total spent, last purchase)
     * computed in SQL. Voided sales never count.
     */
    async list(options: {
        page?: number;
        pageSize?: number;
        search?: string;
        filter?: 'all' | 'debtors' | 'credit' | 'inactive';
        sortBy?: string;
        sortOrder?: 'ASC' | 'DESC';
    } = {}) {
        const page = Math.max(1, Number(options.page) || 1);
        const pageSize = Math.min(100, Math.max(1, Number(options.pageSize) || 10));
        const filter = options.filter ?? 'all';
        const sortOrder: 'ASC' | 'DESC' = options.sortOrder === 'DESC' ? 'DESC' : 'ASC';

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            .toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');

        const buildBase = () => {
            const qb = this.customerRepository.createQueryBuilder('customer');
            const search = typeof options.search === 'string' ? options.search.trim() : '';
            if (search) {
                qb.andWhere(
                    '(customer.name LIKE :s OR customer.phone LIKE :s OR customer.email LIKE :s)',
                    { s: `%${search}%` }
                );
            }
            if (filter === 'debtors') qb.andWhere('customer.balance > 0');
            if (filter === 'credit') qb.andWhere('customer.credit_limit IS NOT NULL');
            return qb;
        };

        const qb = buildBase()
            .leftJoin('customer.sales', 'sale', "sale.status != 'voided'")
            .addSelect('COUNT(sale.id)', 'purchases_count')
            .addSelect('COALESCE(SUM(sale.total_amount), 0)', 'total_spent')
            .addSelect('MAX(sale.created_at)', 'last_purchase_at')
            .groupBy('customer.id');

        if (filter === 'inactive') {
            qb.having('(MAX(sale.created_at) IS NULL OR MAX(sale.created_at) < :cutoff)', { cutoff: thirtyDaysAgo });
        }

        // Sort allowlist — entity columns or SQL aggregate aliases
        const entitySorts: Record<string, string> = {
            name: 'customer.name',
            balance: 'customer.balance',
            created_at: 'customer.created_at',
        };
        const aggregateSorts = new Set(['total_spent', 'purchases_count', 'last_purchase_at']);
        const sortBy = options.sortBy ?? 'name';
        if (aggregateSorts.has(sortBy)) {
            qb.orderBy(sortBy, sortOrder);
        } else {
            qb.orderBy(entitySorts[sortBy] ?? 'customer.name', sortOrder);
        }
        qb.addOrderBy('customer.name', 'ASC');

        qb.offset((page - 1) * pageSize).limit(pageSize);

        const { entities, raw } = await qb.getRawAndEntities();
        const items = entities.map((customer, i) => ({
            ...customer,
            purchases_count: Number(raw[i]?.purchases_count) || 0,
            total_spent: Number(raw[i]?.total_spent) || 0,
            last_purchase_at: raw[i]?.last_purchase_at ?? null,
        }));

        // Total count with the same filters (inactive needs the aggregate)
        let total: number;
        if (filter === 'inactive') {
            const rows = await buildBase()
                .leftJoin('customer.sales', 'sale', "sale.status != 'voided'")
                .select('customer.id')
                .groupBy('customer.id')
                .having('(MAX(sale.created_at) IS NULL OR MAX(sale.created_at) < :cutoff)', { cutoff: thirtyDaysAgo })
                .getRawMany();
            total = rows.length;
        } else {
            total = await buildBase().getCount();
        }

        return {
            items,
            total,
            page,
            pageSize,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
        };
    }

    /** Aggregated profile summary for the customer detail view. */
    async getSummary(customerId: string) {
        const customer = await this.findOne(customerId);
        if (!customer) throw new Error('Cliente no encontrado');

        const salesAgg = await this.saleRepository.createQueryBuilder('sale')
            .select('COUNT(sale.id)', 'purchasesCount')
            .addSelect('COALESCE(SUM(sale.total_amount), 0)', 'totalSpent')
            .addSelect('MAX(sale.created_at)', 'lastPurchaseAt')
            .addSelect('MIN(sale.created_at)', 'firstPurchaseAt')
            .where('sale.customer_id = :customerId', { customerId })
            .andWhere("sale.status != 'voided'")
            .getRawOne();

        const paymentsAgg = await this.debtPaymentRepository.createQueryBuilder('dp')
            .select('COALESCE(SUM(dp.amount), 0)', 'totalPaid')
            .addSelect('COUNT(dp.id)', 'paymentsCount')
            .where('dp.customer_id = :customerId', { customerId })
            .getRawOne();

        const purchasesCount = Number(salesAgg?.purchasesCount) || 0;
        const totalSpent = Number(salesAgg?.totalSpent) || 0;
        const balance = Number(customer.balance) || 0;
        const creditLimit = customer.credit_limit == null ? null : Number(customer.credit_limit);

        return {
            purchasesCount,
            totalSpent,
            averageTicket: purchasesCount > 0 ? totalSpent / purchasesCount : 0,
            lastPurchaseAt: salesAgg?.lastPurchaseAt ?? null,
            firstPurchaseAt: salesAgg?.firstPurchaseAt ?? null,
            totalPaidDebt: Number(paymentsAgg?.totalPaid) || 0,
            paymentsCount: Number(paymentsAgg?.paymentsCount) || 0,
            balance,
            creditLimit,
            creditAvailable: creditLimit == null ? null : Math.max(0, creditLimit - balance),
        };
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

    /**
     * Picks only editable, non-financial fields from an untrusted payload.
     * `balance` is NEVER client-settable — it only changes through sales,
     * debt payments and voids.
     */
    private pickEditableFields(customerData: Partial<Customer>): Partial<Customer> {
        const picked: Partial<Customer> = {};
        const stringFields = ['name', 'phone', 'email', 'address', 'notes'] as const;
        for (const field of stringFields) {
            const value = (customerData as any)[field];
            if (value === undefined) continue;
            if (value === null) {
                (picked as any)[field] = null;
                continue;
            }
            if (typeof value !== 'string') throw new Error(`Campo inválido: ${field}`);
            (picked as any)[field] = value.trim();
        }
        return picked;
    }

    private normalizeCreditLimit(value: unknown): number | null {
        if (value === null || value === '') return null;
        const limit = Number(value);
        if (!Number.isFinite(limit) || limit < 0) throw new Error("Límite de crédito inválido");
        return limit;
    }

    async create(customerData: Partial<Customer>, opts: { allowLimitEdit?: boolean } = {}): Promise<Customer> {
        const data = this.pickEditableFields(customerData);
        if (!data.name) {
            throw new Error("El nombre del cliente es requerido");
        }

        if (customerData.credit_limit !== undefined && customerData.credit_limit !== null) {
            if (!opts.allowLimitEdit) {
                throw new Error("Sin permiso para asignar límite de crédito");
            }
            (data as any).credit_limit = this.normalizeCreditLimit(customerData.credit_limit);
        }

        const newCustomer = this.customerRepository.create({ ...data, balance: 0 });
        return this.customerRepository.save(newCustomer);
    }

    async update(id: string, customerData: Partial<Customer>, opts: { allowLimitEdit?: boolean } = {}): Promise<Customer> {
        const customer = await this.findOne(id);
        if (!customer) {
            throw new Error("Cliente no encontrado");
        }

        const data = this.pickEditableFields(customerData);
        if (data.name !== undefined && !data.name) {
            throw new Error("El nombre del cliente es requerido");
        }

        // Only enforce the permission when the limit actually changes, so edit
        // dialogs may resend the unchanged value freely.
        if (customerData.credit_limit !== undefined) {
            const newLimit = this.normalizeCreditLimit(customerData.credit_limit);
            const currentLimit = customer.credit_limit == null ? null : Number(customer.credit_limit);
            if (newLimit !== currentLimit) {
                if (!opts.allowLimitEdit) {
                    throw new Error("Sin permiso para modificar el límite de crédito");
                }
                (data as any).credit_limit = newLimit;
            }
        }

        this.customerRepository.merge(customer, data);
        return this.customerRepository.save(customer);
    }

    async delete(id: string): Promise<void> {
        const customer = await this.findOne(id);
        if (!customer) {
            throw new Error("Cliente no encontrado");
        }
        if ((Number(customer.balance) || 0) > 0) {
            throw new Error("No se puede eliminar un cliente con deuda pendiente");
        }
        const salesCount = await this.saleRepository.count({ where: { customer_id: id } });
        if (salesCount > 0) {
            throw new Error("No se puede eliminar: el cliente tiene ventas registradas");
        }
        await this.customerRepository.delete(id);
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
