import { AppDataSource } from "@main/config/data-source";
import { EntityManager, Repository } from "typeorm";
import { Supplier } from "@main/modules/suppliers/entities/supplier.entity";
import { Purchase, PurchaseItem } from "@main/modules/suppliers/entities/purchase.entity";
import { SupplierPayment } from "@main/modules/suppliers/entities/supplier-payment.entity";
import { Product } from "@main/modules/products/entities/product.entity";
import { StockMovement } from "@main/modules/products/entities/stock-movement.entity";
import { Shift } from "@main/modules/shifts/entities/shift.entity";
import { ShiftExpense } from "@main/modules/shifts/entities/shift-expense.entity";
import { getSessionUser } from "@main/shared/session";
import { round2 } from "@shared/money";

export interface PurchaseItemInput {
    product_id: string;
    quantity: number;
    unit_cost: number;
}

export interface CreatePurchaseInput {
    supplier_id: string;
    invoice_number?: string;
    notes?: string;
    items: PurchaseItemInput[];
    /** 'credit' = todo a cuenta por pagar; 'cash'/'transfer' pagan `amount_paid` (por defecto el total). */
    payment_method: 'cash' | 'transfer' | 'credit';
    amount_paid?: number;
    /** YYYY-MM-DD; si falta se calcula con los días de crédito del suplidor. */
    due_date?: string | null;
    /** Actualiza el costo de cada producto al costo de esta compra (default: true). */
    update_costs?: boolean;
}

export interface PurchaseListOptions {
    page?: number;
    pageSize?: number;
    search?: string;
    supplierId?: string;
    status?: 'received' | 'cancelled';
    paymentStatus?: 'paid' | 'partial' | 'pending';
    startDate?: string | null;
    endDate?: string | null;
}

const fmt = (d: Date) => d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');

export class PurchasesService {
    private purchaseRepo: Repository<Purchase>;

    constructor() {
        this.purchaseRepo = AppDataSource.getRepository(Purchase);
    }

    private generateShortId(length = 8): string {
        const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let out = '';
        for (let i = 0; i < length; i++) out += chars.charAt(Math.floor(Math.random() * chars.length));
        return out;
    }

    /** Turno abierto del usuario — obligatorio para que el efectivo salga de una caja concreta. */
    private async requireOpenShift(manager: EntityManager, userId: string): Promise<Shift> {
        const shift = await manager.findOne(Shift, { where: { user_id: userId, status: 'open' } });
        if (!shift) throw new Error("Abre un turno en el POS para pagar en efectivo (el dinero sale de tu caja)");
        return shift;
    }

    /** Salida de caja del turno: así el pago aparece en el arqueo sin fórmulas nuevas. */
    private async recordCashOut(manager: EntityManager, shift: Shift, amount: number, reason: string): Promise<ShiftExpense> {
        const expense = manager.create(ShiftExpense, { shift_id: shift.id, amount, reason: reason.slice(0, 200) });
        return manager.save(ShiftExpense, expense);
    }

    /** Aplica un monto FIFO a las compras pendientes del suplidor. */
    private async applyToPendingPurchases(manager: EntityManager, supplierId: string, amount: number, preferPurchaseId?: string | null) {
        let remaining = round2(amount);
        const pending = await manager.find(Purchase, {
            where: [
                { supplier_id: supplierId, status: 'received', payment_status: 'pending' },
                { supplier_id: supplierId, status: 'received', payment_status: 'partial' },
            ],
            order: { created_at: 'ASC' },
        });
        // La compra que se está pagando en el acto va primero
        pending.sort((a, b) => (a.id === preferPurchaseId ? -1 : b.id === preferPurchaseId ? 1 : 0));
        for (const purchase of pending) {
            if (remaining <= 0) break;
            const owed = round2(Number(purchase.total_amount) - Number(purchase.amount_paid || 0));
            if (owed <= 0) continue;
            if (remaining >= owed) {
                purchase.amount_paid = round2(Number(purchase.total_amount));
                purchase.payment_status = 'paid';
                remaining = round2(remaining - owed);
            } else {
                purchase.amount_paid = round2(Number(purchase.amount_paid || 0) + remaining);
                purchase.payment_status = 'partial';
                remaining = 0;
            }
            await manager.save(Purchase, purchase);
        }
    }

    async create(input: CreatePurchaseInput, userId: string): Promise<Purchase> {
        if (!input || typeof input.supplier_id !== 'string' || !input.supplier_id) throw new Error("Selecciona un suplidor");
        if (!Array.isArray(input.items) || input.items.length === 0) throw new Error("Agrega al menos un producto a la compra");
        if (!['cash', 'transfer', 'credit'].includes(input.payment_method)) throw new Error("Forma de pago inválida");
        if (input.due_date != null && input.due_date !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(input.due_date)) {
            throw new Error("La fecha de vencimiento debe tener formato YYYY-MM-DD");
        }

        return AppDataSource.transaction(async (manager) => {
            const supplier = await manager.findOneBy(Supplier, { id: input.supplier_id });
            if (!supplier) throw new Error("Suplidor no encontrado");
            if (!supplier.active) throw new Error("El suplidor está inactivo");

            const session = getSessionUser();
            const updateCosts = input.update_costs !== false;

            // Consolidar líneas repetidas del mismo producto
            const merged = new Map<string, { quantity: number; unit_cost: number }>();
            for (const raw of input.items) {
                const qty = Number(raw.quantity);
                const cost = Number(raw.unit_cost);
                if (typeof raw.product_id !== 'string' || !raw.product_id) throw new Error("Producto inválido en la compra");
                if (!Number.isInteger(qty) || qty <= 0) throw new Error("La cantidad debe ser un entero mayor a 0");
                if (!Number.isFinite(cost) || cost < 0) throw new Error("El costo unitario es inválido");
                const prev = merged.get(raw.product_id);
                merged.set(raw.product_id, { quantity: (prev?.quantity ?? 0) + qty, unit_cost: round2(cost) });
            }

            let purchaseId = '';
            for (let i = 0; i < 10; i++) {
                purchaseId = this.generateShortId();
                if (!(await manager.findOne(Purchase, { where: { id: purchaseId } }))) break;
                purchaseId = '';
            }
            if (!purchaseId) throw new Error("No se pudo generar el id de la compra");

            const items: PurchaseItem[] = [];
            const movements: Array<{ product_id: string; quantity_delta: number; stock_after: number }> = [];
            let total = 0;

            for (const [productId, line] of merged) {
                const product = await manager.findOneBy(Product, { id: productId });
                if (!product) throw new Error("Producto no encontrado");
                const previousCost = Number(product.cost_price) || 0;

                product.stock = Number(product.stock) + line.quantity;
                if (updateCosts) product.cost_price = line.unit_cost;
                await manager.save(Product, product);
                movements.push({ product_id: product.id, quantity_delta: line.quantity, stock_after: product.stock });

                const lineTotal = round2(line.quantity * line.unit_cost);
                total = round2(total + lineTotal);
                items.push(manager.create(PurchaseItem, {
                    product_id: product.id,
                    product_name: product.name,
                    quantity: line.quantity,
                    unit_cost: line.unit_cost,
                    total_cost: lineTotal,
                    previous_cost: previousCost,
                }));
            }

            // Pago
            const isCredit = input.payment_method === 'credit';
            let amountPaid = isCredit ? 0 : round2(input.amount_paid === undefined ? total : Number(input.amount_paid));
            if (!Number.isFinite(amountPaid) || amountPaid < 0) throw new Error("El monto pagado es inválido");
            if (amountPaid > total) throw new Error("El monto pagado no puede superar el total de la compra");
            const outstanding = round2(total - amountPaid);

            let dueDate: Date | null = null;
            if (outstanding > 0) {
                if (input.due_date) dueDate = new Date(`${input.due_date}T12:00:00`);
                else dueDate = new Date(Date.now() + Math.max(0, supplier.credit_days) * 86_400_000);
            }

            const purchase = manager.create(Purchase, {
                id: purchaseId,
                supplier_id: supplier.id,
                supplier_name: supplier.name,
                invoice_number: typeof input.invoice_number === 'string' ? input.invoice_number.trim().slice(0, 40) || undefined : undefined,
                notes: typeof input.notes === 'string' ? input.notes.trim().slice(0, 300) || undefined : undefined,
                status: 'received',
                payment_status: outstanding <= 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'pending',
                total_amount: total,
                amount_paid: amountPaid,
                due_date: dueDate,
                user_id: userId,
                username: session?.username,
                updated_costs: updateCosts,
                items,
            });
            const saved = await manager.save(Purchase, purchase);

            for (const m of movements) {
                await manager.save(StockMovement, manager.create(StockMovement, {
                    ...m,
                    type: 'purchase',
                    reference: saved.id,
                    user_id: session?.id ?? userId,
                    username: session?.username,
                    note: `Compra #${saved.id} · ${supplier.name}`,
                }));
            }

            if (outstanding > 0) {
                supplier.balance = round2(Number(supplier.balance) + outstanding);
                await manager.save(Supplier, supplier);
            }

            if (amountPaid > 0) {
                let shiftId: string | null = null;
                let expenseId: string | null = null;
                if (input.payment_method === 'cash') {
                    const shift = await this.requireOpenShift(manager, userId);
                    const expense = await this.recordCashOut(manager, shift, amountPaid, `Compra #${saved.id} · ${supplier.name}`);
                    shiftId = shift.id;
                    expenseId = expense.id;
                }
                await manager.save(SupplierPayment, manager.create(SupplierPayment, {
                    supplier_id: supplier.id,
                    purchase_id: saved.id,
                    amount: amountPaid,
                    payment_method: input.payment_method as 'cash' | 'transfer',
                    shift_id: shiftId,
                    shift_expense_id: expenseId,
                    notes: `Pago al recibir la compra #${saved.id}`,
                    user_id: userId,
                    username: session?.username,
                }));
            }

            return saved;
        });
    }

    /**
     * Anula una compra: revierte el stock (kardex 'purchase_void') y la cuenta
     * por pagar. No se permite si ya tiene pagos ni si la mercancía ya se vendió.
     */
    async cancel(purchaseId: string, reason?: string): Promise<Purchase> {
        return AppDataSource.transaction(async (manager) => {
            const purchase = await manager.findOne(Purchase, { where: { id: purchaseId }, relations: ['items'] });
            if (!purchase) throw new Error("Compra no encontrada");
            if (purchase.status === 'cancelled') throw new Error("Esta compra ya está anulada");
            if (Number(purchase.amount_paid) > 0) {
                throw new Error("La compra tiene pagos registrados: no se puede anular. Registra la diferencia como ajuste de stock.");
            }
            const session = getSessionUser();
            for (const item of purchase.items) {
                const product = await manager.findOneBy(Product, { id: item.product_id });
                if (!product) continue;
                if (Number(product.stock) < item.quantity) {
                    throw new Error(`No se puede anular: de "${item.product_name}" ya se vendieron unidades de esta compra`);
                }
                product.stock = Number(product.stock) - item.quantity;
                if (purchase.updated_costs && item.previous_cost != null) product.cost_price = Number(item.previous_cost);
                await manager.save(Product, product);
                await manager.save(StockMovement, manager.create(StockMovement, {
                    product_id: product.id,
                    type: 'purchase_void',
                    quantity_delta: -item.quantity,
                    stock_after: product.stock,
                    reference: purchase.id,
                    user_id: session?.id,
                    username: session?.username,
                    note: `Anulación de compra #${purchase.id}`,
                }));
            }
            const supplier = await manager.findOneBy(Supplier, { id: purchase.supplier_id });
            if (supplier) {
                const outstanding = round2(Number(purchase.total_amount) - Number(purchase.amount_paid || 0));
                supplier.balance = Math.max(0, round2(Number(supplier.balance) - outstanding));
                await manager.save(Supplier, supplier);
            }
            purchase.status = 'cancelled';
            purchase.cancelled_at = new Date();
            if (reason) purchase.notes = [purchase.notes, `Anulada: ${String(reason).slice(0, 200)}`].filter(Boolean).join(' · ');
            return manager.save(Purchase, purchase);
        });
    }

    /** Abono a la cuenta por pagar de un suplidor (efectivo sale del turno abierto). */
    async paySupplier(supplierId: string, amount: number, method: 'cash' | 'transfer', userId: string, notes?: string) {
        const amt = round2(Number(amount));
        if (!Number.isFinite(amt) || amt <= 0) throw new Error("El monto debe ser mayor a 0");
        if (method !== 'cash' && method !== 'transfer') throw new Error("Método de pago inválido");

        return AppDataSource.transaction(async (manager) => {
            const supplier = await manager.findOneBy(Supplier, { id: supplierId });
            if (!supplier) throw new Error("Suplidor no encontrado");
            const balance = round2(Number(supplier.balance) || 0);
            if (balance <= 0) throw new Error("Este suplidor no tiene cuentas por pagar");
            if (amt > balance) throw new Error(`El monto excede lo pendiente (${balance.toFixed(2)})`);

            const session = getSessionUser();
            let shiftId: string | null = null;
            let expenseId: string | null = null;
            if (method === 'cash') {
                const shift = await this.requireOpenShift(manager, userId);
                const expense = await this.recordCashOut(manager, shift, amt, `Pago a suplidor · ${supplier.name}`);
                shiftId = shift.id;
                expenseId = expense.id;
            }

            supplier.balance = round2(balance - amt);
            await manager.save(Supplier, supplier);

            const payment = await manager.save(SupplierPayment, manager.create(SupplierPayment, {
                supplier_id: supplier.id,
                purchase_id: null,
                amount: amt,
                payment_method: method,
                shift_id: shiftId,
                shift_expense_id: expenseId,
                notes: typeof notes === 'string' ? notes.trim().slice(0, 200) || undefined : undefined,
                user_id: userId,
                username: session?.username,
            }));

            await this.applyToPendingPurchases(manager, supplier.id, amt);

            return { payment, newBalance: supplier.balance, expenseId };
        });
    }

    async findOne(id: string): Promise<Purchase | null> {
        return this.purchaseRepo.findOne({ where: { id }, relations: ['items', 'supplier'] });
    }

    async list(options: PurchaseListOptions = {}) {
        const page = Math.max(1, Number(options.page) || 1);
        const pageSize = Math.min(100, Math.max(1, Number(options.pageSize) || 15));
        const qb = this.purchaseRepo.createQueryBuilder('p');

        const search = typeof options.search === 'string' ? options.search.trim() : '';
        if (search) qb.andWhere('(p.id LIKE :s OR p.supplier_name LIKE :s OR p.invoice_number LIKE :s)', { s: `%${search}%` });
        if (options.supplierId) qb.andWhere('p.supplier_id = :sid', { sid: options.supplierId });
        if (options.status === 'received' || options.status === 'cancelled') qb.andWhere('p.status = :st', { st: options.status });
        if (['paid', 'partial', 'pending'].includes(options.paymentStatus as string)) {
            qb.andWhere('p.payment_status = :ps', { ps: options.paymentStatus });
        }
        const start = options.startDate ? new Date(options.startDate) : null;
        const end = options.endDate ? new Date(options.endDate) : null;
        if (start && !isNaN(start.getTime())) qb.andWhere('p.created_at >= :start', { start: fmt(start) });
        if (end && !isNaN(end.getTime())) qb.andWhere('p.created_at <= :end', { end: fmt(end) });

        const [items, total] = await qb
            .orderBy('p.created_at', 'DESC')
            .skip((page - 1) * pageSize)
            .take(pageSize)
            .getManyAndCount();

        return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
    }
}
