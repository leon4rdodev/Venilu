import { AppDataSource } from "@main/config/data-source";
import { Repository } from "typeorm";
import { Supplier } from "@main/modules/suppliers/entities/supplier.entity";
import { Purchase } from "@main/modules/suppliers/entities/purchase.entity";
import { SupplierPayment } from "@main/modules/suppliers/entities/supplier-payment.entity";
import { round2 } from "@shared/money";

export type SupplierFilter = 'all' | 'debtors' | 'inactive';

export interface SupplierListOptions {
    page?: number;
    pageSize?: number;
    search?: string;
    filter?: SupplierFilter;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}

const fmt = (d: Date) => d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');

export class SuppliersService {
    private repo: Repository<Supplier>;

    constructor() {
        this.repo = AppDataSource.getRepository(Supplier);
    }

    /** Whitelist de campos editables — nunca id, balance ni timestamps. */
    private pickEditable(data: Partial<Supplier>) {
        const out: Partial<Supplier> = {};
        const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
        if (data.name !== undefined) out.name = str(data.name);
        if (data.rnc !== undefined) out.rnc = str(data.rnc).replace(/\D/g, '') || undefined;
        if (data.contact_name !== undefined) out.contact_name = str(data.contact_name) || undefined;
        if (data.phone !== undefined) out.phone = str(data.phone).replace(/\D/g, '') || undefined;
        if (data.email !== undefined) out.email = str(data.email) || undefined;
        if (data.address !== undefined) out.address = str(data.address) || undefined;
        if (data.notes !== undefined) out.notes = str(data.notes) || undefined;
        if (data.credit_days !== undefined) {
            const days = Number(data.credit_days);
            if (!Number.isInteger(days) || days < 0 || days > 365) {
                throw new Error("Los días de crédito deben ser un entero entre 0 y 365");
            }
            out.credit_days = days;
        }
        if (data.active !== undefined) out.active = Boolean(data.active);
        return out;
    }

    private validate(data: Partial<Supplier>, requireName: boolean) {
        if (requireName && !data.name) throw new Error("El nombre del suplidor es requerido");
        if (data.name !== undefined && !data.name) throw new Error("El nombre del suplidor es requerido");
        if (data.rnc && !/^(\d{9}|\d{11})$/.test(data.rnc)) {
            throw new Error("El RNC debe tener 9 dígitos (o 11 si es cédula)");
        }
        if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            throw new Error("El correo electrónico no es válido");
        }
    }

    async create(data: Partial<Supplier>): Promise<Supplier> {
        const clean = this.pickEditable(data);
        this.validate(clean, true);
        const dup = await this.repo.createQueryBuilder('s')
            .where('LOWER(s.name) = LOWER(:name)', { name: clean.name })
            .getOne();
        if (dup) throw new Error(`Ya existe un suplidor llamado "${dup.name}"`);
        return this.repo.save(this.repo.create({ ...clean, balance: 0, active: clean.active ?? true }));
    }

    async update(id: string, data: Partial<Supplier>): Promise<Supplier> {
        const supplier = await this.repo.findOneBy({ id });
        if (!supplier) throw new Error("Suplidor no encontrado");
        const clean = this.pickEditable(data);
        this.validate(clean, false);
        if (clean.name && clean.name.toLowerCase() !== supplier.name.toLowerCase()) {
            const dup = await this.repo.createQueryBuilder('s')
                .where('LOWER(s.name) = LOWER(:name) AND s.id != :id', { name: clean.name, id })
                .getOne();
            if (dup) throw new Error(`Ya existe un suplidor llamado "${dup.name}"`);
        }
        this.repo.merge(supplier, clean);
        return this.repo.save(supplier);
    }

    /** Un suplidor con compras registradas no se borra (trazabilidad): se desactiva. */
    async delete(id: string): Promise<{ deleted: boolean; deactivated: boolean }> {
        const supplier = await this.repo.findOneBy({ id });
        if (!supplier) throw new Error("Suplidor no encontrado");
        if (Number(supplier.balance) > 0) {
            throw new Error("No se puede eliminar un suplidor con cuentas por pagar pendientes");
        }
        const purchases = await AppDataSource.getRepository(Purchase).count({ where: { supplier_id: id } });
        if (purchases > 0) {
            supplier.active = false;
            await this.repo.save(supplier);
            return { deleted: false, deactivated: true };
        }
        await this.repo.delete({ id });
        return { deleted: true, deactivated: false };
    }

    async findOne(id: string): Promise<Supplier | null> {
        return this.repo.findOneBy({ id });
    }

    /** Suplidores activos, para selectores. */
    async findActive(): Promise<Supplier[]> {
        return this.repo.find({ where: { active: true }, order: { name: 'ASC' } });
    }

    async search(query: string): Promise<Supplier[]> {
        const q = typeof query === 'string' ? query.trim() : '';
        const qb = this.repo.createQueryBuilder('s').where('s.active = 1');
        if (q) qb.andWhere('(s.name LIKE :q OR s.contact_name LIKE :q OR s.phone LIKE :q OR s.rnc LIKE :q)', { q: `%${q}%` });
        return qb.orderBy('s.name', 'ASC').limit(20).getMany();
    }

    async list(options: SupplierListOptions = {}) {
        const page = Math.max(1, Number(options.page) || 1);
        const pageSize = Math.min(100, Math.max(1, Number(options.pageSize) || 10));
        const filter: SupplierFilter = options.filter ?? 'all';
        const sortOrder: 'ASC' | 'DESC' = options.sortOrder === 'DESC' ? 'DESC' : 'ASC';

        const buildBase = () => {
            const qb = this.repo.createQueryBuilder('supplier');
            const search = typeof options.search === 'string' ? options.search.trim() : '';
            if (search) {
                qb.andWhere(
                    '(supplier.name LIKE :s OR supplier.contact_name LIKE :s OR supplier.phone LIKE :s OR supplier.rnc LIKE :s OR supplier.email LIKE :s)',
                    { s: `%${search}%` },
                );
            }
            if (filter === 'debtors') qb.andWhere('supplier.balance > 0');
            if (filter === 'inactive') qb.andWhere('supplier.active = 0');
            if (filter === 'all') qb.andWhere('supplier.active = 1');
            return qb;
        };

        const qb = buildBase()
            .leftJoin('supplier.purchases', 'purchase', "purchase.status != 'cancelled'")
            .addSelect('COUNT(purchase.id)', 'purchases_count')
            .addSelect('COALESCE(SUM(purchase.total_amount), 0)', 'total_purchased')
            .addSelect('MAX(purchase.created_at)', 'last_purchase_at')
            .groupBy('supplier.id');

        const entitySorts: Record<string, string> = {
            name: 'supplier.name',
            balance: 'supplier.balance',
            created_at: 'supplier.created_at',
        };
        const aggregateSorts = new Set(['total_purchased', 'purchases_count', 'last_purchase_at']);
        const sortBy = options.sortBy ?? 'name';
        if (aggregateSorts.has(sortBy)) qb.orderBy(sortBy, sortOrder);
        else qb.orderBy(entitySorts[sortBy] ?? 'supplier.name', sortOrder);
        qb.addOrderBy('supplier.name', 'ASC');
        qb.offset((page - 1) * pageSize).limit(pageSize);

        const { entities, raw } = await qb.getRawAndEntities();
        const items = entities.map((supplier, i) => ({
            ...supplier,
            balance: Number(supplier.balance) || 0,
            purchases_count: Number(raw[i]?.purchases_count) || 0,
            total_purchased: Number(raw[i]?.total_purchased) || 0,
            last_purchase_at: raw[i]?.last_purchase_at ?? null,
        }));
        const total = await buildBase().getCount();

        return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
    }

    /** Tarjetas de la pantalla de suplidores. */
    async getStats() {
        const now = new Date();
        const monthStart = fmt(new Date(now.getFullYear(), now.getMonth(), 1));

        const [base, month, overdue, paidMonth] = await Promise.all([
            this.repo.createQueryBuilder('s')
                .select('COUNT(s.id)', 'total')
                .addSelect('SUM(CASE WHEN s.active = 1 THEN 1 ELSE 0 END)', 'active')
                .addSelect('SUM(CASE WHEN s.balance > 0 THEN 1 ELSE 0 END)', 'withDebt')
                .addSelect('COALESCE(SUM(s.balance), 0)', 'totalPayable')
                .getRawOne(),
            AppDataSource.getRepository(Purchase).createQueryBuilder('p')
                .select('COUNT(p.id)', 'count')
                .addSelect('COALESCE(SUM(p.total_amount), 0)', 'amount')
                .where("p.status != 'cancelled'")
                .andWhere('p.created_at >= :monthStart', { monthStart })
                .getRawOne(),
            AppDataSource.getRepository(Purchase).createQueryBuilder('p')
                .select('COUNT(p.id)', 'count')
                .addSelect('COALESCE(SUM(p.total_amount - p.amount_paid), 0)', 'amount')
                .where("p.status != 'cancelled' AND p.payment_status != 'paid'")
                .andWhere('p.due_date IS NOT NULL AND p.due_date < :now', { now: fmt(now) })
                .getRawOne(),
            AppDataSource.getRepository(SupplierPayment).createQueryBuilder('pay')
                .select('COALESCE(SUM(pay.amount), 0)', 'amount')
                .where('pay.created_at >= :monthStart', { monthStart })
                .getRawOne(),
        ]);

        return {
            totalSuppliers: Number(base?.total) || 0,
            activeSuppliers: Number(base?.active) || 0,
            suppliersWithDebt: Number(base?.withDebt) || 0,
            totalPayable: round2(Number(base?.totalPayable) || 0),
            purchasesThisMonth: Number(month?.count) || 0,
            purchasedThisMonth: round2(Number(month?.amount) || 0),
            overduePurchases: Number(overdue?.count) || 0,
            overdueAmount: round2(Number(overdue?.amount) || 0),
            paidThisMonth: round2(Number(paidMonth?.amount) || 0),
        };
    }

    /** Resumen para la ficha del suplidor. */
    async getSummary(id: string) {
        const supplier = await this.repo.findOneBy({ id });
        if (!supplier) throw new Error("Suplidor no encontrado");
        const [purchases, payments, overdue] = await Promise.all([
            AppDataSource.getRepository(Purchase).createQueryBuilder('p')
                .select('COUNT(p.id)', 'count')
                .addSelect('COALESCE(SUM(p.total_amount), 0)', 'amount')
                .addSelect('MAX(p.created_at)', 'last')
                .addSelect('MIN(p.created_at)', 'first')
                .where("p.supplier_id = :id AND p.status != 'cancelled'", { id })
                .getRawOne(),
            AppDataSource.getRepository(SupplierPayment).createQueryBuilder('pay')
                .select('COUNT(pay.id)', 'count')
                .addSelect('COALESCE(SUM(pay.amount), 0)', 'amount')
                .where('pay.supplier_id = :id', { id })
                .getRawOne(),
            AppDataSource.getRepository(Purchase).createQueryBuilder('p')
                .select('COALESCE(SUM(p.total_amount - p.amount_paid), 0)', 'amount')
                .where("p.supplier_id = :id AND p.status != 'cancelled' AND p.payment_status != 'paid'", { id })
                .andWhere('p.due_date IS NOT NULL AND p.due_date < :now', { now: fmt(new Date()) })
                .getRawOne(),
        ]);
        const purchasesCount = Number(purchases?.count) || 0;
        const totalPurchased = round2(Number(purchases?.amount) || 0);
        return {
            purchasesCount,
            totalPurchased,
            averagePurchase: purchasesCount > 0 ? round2(totalPurchased / purchasesCount) : 0,
            lastPurchaseAt: purchases?.last ?? null,
            firstPurchaseAt: purchases?.first ?? null,
            paymentsCount: Number(payments?.count) || 0,
            totalPaid: round2(Number(payments?.amount) || 0),
            balance: round2(Number(supplier.balance) || 0),
            overdueAmount: round2(Number(overdue?.amount) || 0),
            creditDays: supplier.credit_days,
        };
    }

    async getPayments(supplierId: string, page = 1, limit = 15) {
        const take = Math.min(100, Math.max(1, Number(limit) || 15));
        const skip = (Math.max(1, Number(page) || 1) - 1) * take;
        const repo = AppDataSource.getRepository(SupplierPayment);
        const [items, total] = await repo.findAndCount({
            where: { supplier_id: supplierId },
            order: { created_at: 'DESC' },
            skip, take,
        });
        return { items, total, totalPages: Math.max(1, Math.ceil(total / take)) };
    }
}
