import { AppDataSource } from "@main/config/data-source";
import { Sale as SaleEntity } from "@main/modules/sales/entities/sale.entity";
import { SaleItem as SaleItemEntity } from "@main/modules/sales/entities/sale-item.entity";
import { Product as ProductEntity } from "@main/modules/products/entities/product.entity";
import { Shift as ShiftEntity } from "@main/modules/shifts/entities/shift.entity";
import { Customer as CustomerEntity } from "@main/modules/customers/entities/customer.entity";
import { DebtPayment as DebtPaymentEntity } from "@main/modules/sales/entities/debt-payment.entity";
import { Repository, DataSource } from "typeorm";
import { round2 } from "@shared/money";

interface ProcessSaleData {
    user_id: string;
    shift_id: string;
    payment_method: 'cash' | 'card' | 'transfer' | 'credit';
    customer_id?: string;
    subtotal?: number;
    discount_amount?: number;
    total_amount?: number;
    amount_paid?: number;
    change_given?: number;
}

interface SaleItemInput {
    product_id: string;
    quantity: number;
    unit_price?: number;
}

export class SalesService {
    private saleRepository: Repository<SaleEntity>;
    private shiftRepository: Repository<ShiftEntity>;
    private customerRepository: Repository<CustomerEntity>;
    private debtPaymentRepository: Repository<DebtPaymentEntity>;
    private dataSource: DataSource;

    constructor() {
        this.dataSource = AppDataSource;
        this.saleRepository = AppDataSource.getRepository(SaleEntity);
        this.shiftRepository = AppDataSource.getRepository(ShiftEntity);
        this.customerRepository = AppDataSource.getRepository(CustomerEntity);
        this.debtPaymentRepository = AppDataSource.getRepository(DebtPaymentEntity);
    }

    private generateShortId(length: number = 8): string {
        const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /** Removes sensitive fields from an eagerly-joined user before IPC. */
    private sanitizeSaleUser(sale: SaleEntity): SaleEntity {
        if (sale.user) {
            delete (sale.user as any).password;
            delete (sale.user as any).session_token;
        }
        return sale;
    }

    async processSale(
        saleData: ProcessSaleData,
        items: SaleItemInput[],
        options: { allowPriceOverride?: boolean } = {}
    ): Promise<{ success: true; saleId: string }> {
        if (!items || items.length === 0) {
            throw new Error("No items in sale");
        }

        // Validate Shift — must be open AND belong to the session user
        const shift = await this.shiftRepository.findOneBy({ id: saleData.shift_id });
        if (!shift || shift.status !== 'open') {
            throw new Error("Shift is not open or invalid");
        }
        if (shift.user_id !== saleData.user_id) {
            throw new Error("El turno no pertenece al usuario de la sesión");
        }

        // Credit sales require a customer
        if (saleData.payment_method === 'credit' && !saleData.customer_id) {
            throw new Error("Las ventas a crédito requieren un cliente seleccionado");
        }

        return await this.dataSource.transaction(async (transactionalEntityManager) => {
            // Load the customer inside the transaction so the credit-limit
            // check can't race with a concurrent sale.
            let customer: CustomerEntity | null = null;
            if (saleData.customer_id) {
                customer = await transactionalEntityManager.findOneBy(CustomerEntity, { id: saleData.customer_id });
                if (!customer) {
                    throw new Error("Cliente no encontrado");
                }
            }

            let calculatedSubtotal = 0;
            const saleItems: SaleItemEntity[] = [];

            for (const item of items) {
                const quantity = Number(item.quantity);
                if (!Number.isInteger(quantity) || quantity <= 0) {
                    throw new Error("Cantidad inválida en la venta");
                }

                const product = await transactionalEntityManager.findOne(ProductEntity, { where: { id: item.product_id } });
                if (!product) {
                    throw new Error(`Product not found: ${item.product_id}`);
                }

                if (product.stock < quantity) {
                    throw new Error(`Insufficient stock for product: ${product.name}`);
                }

                // Update stock
                product.stock -= quantity;
                await transactionalEntityManager.save(product);

                // Unit price is ALWAYS the DB price unless the user holds
                // pos:price_override and explicitly sends one.
                let unitPrice = round2(Number(product.sale_price));
                if (options.allowPriceOverride && item.unit_price !== undefined) {
                    const override = Number(item.unit_price);
                    if (!Number.isFinite(override) || override < 0) {
                        throw new Error("Precio unitario inválido");
                    }
                    unitPrice = round2(override);
                }

                // Create Sale Item
                const saleItem = new SaleItemEntity();
                saleItem.product_id = product.id;
                saleItem.product_name = product.name;
                saleItem.quantity = quantity;
                saleItem.unit_price = unitPrice;
                saleItem.total_price = round2(quantity * unitPrice);

                saleItems.push(saleItem);
                calculatedSubtotal = round2(calculatedSubtotal + saleItem.total_price);
            }

            const discountAmount = round2(Number(saleData.discount_amount) || 0);
            if (!Number.isFinite(discountAmount) || discountAmount < 0) {
                throw new Error("Discount amount cannot be negative");
            }
            if (discountAmount > calculatedSubtotal) {
                throw new Error("Discount cannot be greater than the subtotal");
            }

            const finalTotal = round2(calculatedSubtotal - discountAmount);

            // Credit limit check — uses the SERVER-computed total, inside the transaction
            if (saleData.payment_method === 'credit' && customer && customer.credit_limit != null) {
                const currentBalance = Number(customer.balance) || 0;
                if (round2(currentBalance + finalTotal) > Number(customer.credit_limit)) {
                    throw new Error(
                        `El cliente ha alcanzado su límite de crédito de ${Number(customer.credit_limit).toFixed(2)}. Deuda actual: ${currentBalance.toFixed(2)}`
                    );
                }
            }

            // Generate unique short ID
            let saleId = '';
            let isUnique = false;
            let attempts = 0;

            while (!isUnique && attempts < 10) {
                saleId = this.generateShortId();
                const existing = await transactionalEntityManager.findOne(SaleEntity, { where: { id: saleId } });
                if (!existing) {
                    isUnique = true;
                }
                attempts++;
            }

            if (!isUnique) {
                throw new Error("Failed to generate a unique sale ID after multiple attempts");
            }

            // Determine sale status
            const isCredit = saleData.payment_method === 'credit';
            const status = isCredit ? 'credit' : 'paid';

            // Create Sale
            const sale = new SaleEntity();
            sale.id = saleId;
            sale.user_id = saleData.user_id;
            sale.shift_id = saleData.shift_id;
            sale.payment_method = saleData.payment_method;
            sale.subtotal = calculatedSubtotal;
            sale.discount_amount = discountAmount;
            sale.total_amount = finalTotal;

            // amount_paid / change_given are derived server-side:
            //  - credit: nothing paid up-front
            //  - cash: validate the tendered amount covers the total
            //  - card/transfer: exact amount, no change
            if (isCredit) {
                sale.amount_paid = 0;
                sale.change_given = 0;
            } else if (saleData.payment_method === 'cash') {
                const paid = round2(Number(saleData.amount_paid ?? finalTotal));
                if (!Number.isFinite(paid) || paid < finalTotal) {
                    throw new Error("El monto pagado es insuficiente");
                }
                sale.amount_paid = paid;
                sale.change_given = round2(paid - finalTotal);
            } else {
                sale.amount_paid = finalTotal;
                sale.change_given = 0;
            }

            sale.status = status;
            sale.items = saleItems;

            // Associate customer
            if (customer) {
                sale.customer_id = customer.id;
                sale.customer_name = customer.name;
            }

            const savedSale = await transactionalEntityManager.save(SaleEntity, sale);

            // Update customer balance for credit sales
            if (isCredit && customer) {
                customer.balance = round2((Number(customer.balance) || 0) + finalTotal);
                await transactionalEntityManager.save(CustomerEntity, customer);
            }
            
            return { success: true, saleId: savedSale.id };
        });
    }

    async payDebt(
        customerId: string,
        amount: number,
        shiftId: string | undefined,
        paymentMethod: 'cash' | 'transfer' = 'cash',
        sessionUserId?: string
    ): Promise<{ success: true; newBalance: number; payment: DebtPaymentEntity }> {
        const amt = round2(Number(amount));
        if (!Number.isFinite(amt) || amt <= 0) {
            throw new Error("El monto debe ser un número mayor a 0");
        }
        if (paymentMethod !== 'cash' && paymentMethod !== 'transfer') {
            throw new Error("Método de pago inválido");
        }

        return await this.dataSource.transaction(async (transactionalEntityManager) => {
            const customer = await transactionalEntityManager.findOneBy(CustomerEntity, { id: customerId });
            if (!customer) {
                throw new Error("Cliente no encontrado");
            }

            // The shift the payment is attributed to must exist, be open and
            // belong to the session user — otherwise cash could be routed to
            // another user's register (or to none at all).
            if (shiftId) {
                const shift = await transactionalEntityManager.findOneBy(ShiftEntity, { id: shiftId });
                if (!shift || shift.status !== 'open') {
                    throw new Error("El turno indicado no existe o no está abierto");
                }
                if (sessionUserId && shift.user_id !== sessionUserId) {
                    throw new Error("El turno no pertenece al usuario de la sesión");
                }
            }

            const currentBalance = round2(Number(customer.balance) || 0);
            if (currentBalance <= 0) {
                throw new Error("Este cliente no tiene deuda pendiente");
            }

            if (amt > currentBalance) {
                throw new Error(`El monto excede la deuda pendiente de RD$${currentBalance.toFixed(2)}`);
            }

            // Update global customer balance
            customer.balance = round2(currentBalance - amt);
            await transactionalEntityManager.save(CustomerEntity, customer);

            // Record the debt payment linked to the current shift
            const debtPayment = this.debtPaymentRepository.create({
                customer_id: customerId,
                shift_id: shiftId || undefined,
                amount: amt,
                payment_method: paymentMethod,
            });
            await transactionalEntityManager.save(DebtPaymentEntity, debtPayment);

            // Fetch pending credit sales (oldest first)
            const pendingSales = await transactionalEntityManager.find(SaleEntity, {
                where: [
                    { customer_id: customerId, status: 'credit' },
                    { customer_id: customerId, status: 'partial' }
                ],
                order: { created_at: 'ASC' }
            });

            let remainingAmount = amt;

            for (const sale of pendingSales) {
                if (remainingAmount <= 0) break;

                const totalOwedForSale = round2(Number(sale.total_amount));
                const alreadyPaid = round2(Number(sale.amount_paid || 0));
                const pendingForSale = round2(totalOwedForSale - alreadyPaid);

                if (pendingForSale <= 0) continue;

                if (remainingAmount >= pendingForSale) {
                    // Sale fully paid
                    sale.amount_paid = totalOwedForSale;
                    sale.status = 'paid';
                    remainingAmount = round2(remainingAmount - pendingForSale);
                } else {
                    // Sale partially paid
                    sale.amount_paid = round2(alreadyPaid + remainingAmount);
                    sale.status = 'partial';
                    remainingAmount = 0;
                }

                await transactionalEntityManager.save(SaleEntity, sale);
            }

            return { success: true as const, newBalance: customer.balance, payment: debtPayment };
        });
    }

    async getCustomerSales(customerId: string): Promise<SaleEntity[]> {
        return this.saleRepository.find({
            where: { customer_id: customerId },
            order: { created_at: 'DESC' },
            relations: ['items'],
        });
    }

    async getSales(limit: number = 50): Promise<SaleEntity[]> {
        const take = Math.min(500, Math.max(1, Number(limit) || 50));
        const sales = await this.saleRepository.find({
            order: { created_at: 'DESC' },
            take,
            relations: ['user', 'items', 'customer']
        });
        return sales.map(s => this.sanitizeSaleUser(s));
    }

    /**
     * Server-side filtered + paginated transaction list (mature-POS history view).
     * All filters optional; everything is validated/clamped here.
     */
    async listSales(options: {
        page?: number;
        pageSize?: number;
        search?: string;
        method?: string;
        status?: string;
        startDate?: string | Date | null;
        endDate?: string | Date | null;
    } = {}) {
        const page = Math.max(1, Number(options.page) || 1);
        const pageSize = Math.min(100, Math.max(1, Number(options.pageSize) || 25));

        const qb = this.saleRepository.createQueryBuilder('sale')
            .leftJoinAndSelect('sale.user', 'user')
            .leftJoinAndSelect('sale.customer', 'customer');

        const search = typeof options.search === 'string' ? options.search.trim() : '';
        if (search) {
            qb.andWhere('(sale.id LIKE :search OR sale.customer_name LIKE :search)', {
                search: `%${search}%`,
            });
        }

        if (['cash', 'card', 'transfer', 'credit'].includes(options.method as string)) {
            qb.andWhere('sale.payment_method = :method', { method: options.method });
        }

        if (['paid', 'credit', 'partial', 'voided'].includes(options.status as string)) {
            qb.andWhere('sale.status = :status', { status: options.status });
        }

        const start = options.startDate ? new Date(options.startDate) : null;
        const end = options.endDate ? new Date(options.endDate) : null;
        if (start && !isNaN(start.getTime())) {
            qb.andWhere('sale.created_at >= :start', {
                start: start.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ''),
            });
        }
        if (end && !isNaN(end.getTime())) {
            qb.andWhere('sale.created_at <= :end', {
                end: end.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ''),
            });
        }

        const [items, total] = await qb
            .orderBy('sale.created_at', 'DESC')
            .skip((page - 1) * pageSize)
            .take(pageSize)
            .getManyAndCount();

        return {
            items: items.map(s => this.sanitizeSaleUser(s)),
            total,
            page,
            pageSize,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
        };
    }

    async getRecentSales(limit: number = 5): Promise<SaleEntity[]> {
        const take = Math.min(100, Math.max(1, Number(limit) || 5));
        const sales = await this.saleRepository.find({
            order: { created_at: 'DESC' },
            take,
            relations: ['user']
        });
        return sales.map(s => this.sanitizeSaleUser(s));
    }

    async getSalesByShiftId(shiftId: string): Promise<SaleEntity[]> {
        return this.saleRepository.find({
            where: { shift_id: shiftId },
            order: { created_at: 'DESC' },
            relations: ['items']
        });
    }

    async findOne(id: string): Promise<SaleEntity | null> {
        const sale = await this.saleRepository.findOne({
            where: { id },
            relations: ['items', 'user', 'customer']
        });
        return sale ? this.sanitizeSaleUser(sale) : null;
    }

    async findAll(limit: number = 100): Promise<SaleEntity[]> {
        return this.saleRepository.find({
            order: { created_at: "DESC" },
            take: limit
        });
    }

    async getSaleItems(saleId: string): Promise<SaleItemEntity[]> {
        const sale = await this.saleRepository.findOne({
            where: { id: saleId },
            relations: ['items', 'items.product']
        });
        
        if (!sale) return [];

        return sale.items;
    }

    async voidSale(saleId: string): Promise<{ success: boolean; message?: string }> {
        return await this.dataSource.transaction(async (transactionalEntityManager) => {
            const sale = await transactionalEntityManager.findOne(SaleEntity, {
                where: { id: saleId },
                relations: ['items', 'items.product']
            });

            if (!sale) {
                throw new Error("Venta no encontrada");
            }

            if (sale.status === 'voided') {
                throw new Error("Esta venta ya ha sido anulada");
            }

            // Restore stock
            for (const item of sale.items) {
                if (item.product_id) {
                    const product = await transactionalEntityManager.findOne(ProductEntity, {
                        where: { id: item.product_id }
                    });
                    if (product) {
                        product.stock += item.quantity;
                        await transactionalEntityManager.save(ProductEntity, product);
                    }
                }
            }

            // If it was credit, update customer balance
            if (sale.payment_method === 'credit' && sale.customer_id) {
                const customer = await transactionalEntityManager.findOne(CustomerEntity, {
                    where: { id: sale.customer_id }
                });
                if (customer) {
                    // Only the OUTSTANDING portion is still owed — debt payments
                    // already applied to this sale must not be subtracted again.
                    const outstanding = round2(Number(sale.total_amount) - Number(sale.amount_paid || 0));
                    if (outstanding > 0) {
                        customer.balance = Math.max(0, round2(Number(customer.balance) - outstanding));
                        await transactionalEntityManager.save(CustomerEntity, customer);
                    }
                }
            }

            // Mark as voided
            sale.status = 'voided';
            await transactionalEntityManager.save(SaleEntity, sale);

            return { success: true, message: "Venta anulada correctamente" };
        });
    }
}
