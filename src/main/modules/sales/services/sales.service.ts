import { AppDataSource } from "@main/config/data-source";
import { Sale as SaleEntity } from "@main/modules/sales/entities/sale.entity";
import { SaleItem as SaleItemEntity } from "@main/modules/sales/entities/sale-item.entity";
import { Product as ProductEntity } from "@main/modules/products/entities/product.entity";
import { Shift as ShiftEntity } from "@main/modules/shifts/entities/shift.entity";
import { Customer as CustomerEntity } from "@main/modules/customers/entities/customer.entity";
import { DebtPayment as DebtPaymentEntity } from "@main/modules/sales/entities/debt-payment.entity";
import { Repository, DataSource } from "typeorm";

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

    async processSale(saleData: ProcessSaleData, items: SaleItemInput[]): Promise<{ success: true; saleId: string }> {
        if (!items || items.length === 0) {
            throw new Error("No items in sale");
        }

        // Validate Shift
        const shift = await this.shiftRepository.findOneBy({ id: saleData.shift_id });
        if (!shift || shift.status !== 'open') {
            throw new Error("Shift is not open or invalid");
        }

        // Credit sales require a customer
        if (saleData.payment_method === 'credit' && !saleData.customer_id) {
            throw new Error("Las ventas a crédito requieren un cliente seleccionado");
        }

        // Validate customer if provided
        let customer: CustomerEntity | null = null;
        if (saleData.customer_id) {
            customer = await this.customerRepository.findOneBy({ id: saleData.customer_id });
            if (!customer) {
                throw new Error("Cliente no encontrado");
            }
        }

        // Credit limit check
        if (saleData.payment_method === 'credit' && customer && customer.credit_limit != null) {
            const currentBalance = Number(customer.balance);
            const finalTotal = (saleData.total_amount ?? 0);
            if (currentBalance + finalTotal > Number(customer.credit_limit)) {
                throw new Error(
                    `El cliente ha alcanzado su límite de crédito de ${Number(customer.credit_limit).toFixed(2)}. Deuda actual: ${currentBalance.toFixed(2)}`
                );
            }
        }

        return await this.dataSource.transaction(async (transactionalEntityManager) => {
            let calculatedSubtotal = 0;
            const saleItems: SaleItemEntity[] = [];

            for (const item of items) {
                const product = await transactionalEntityManager.findOne(ProductEntity, { where: { id: item.product_id } });
                if (!product) {
                    throw new Error(`Product not found: ${item.product_id}`);
                }

                if (product.stock < item.quantity) {
                    throw new Error(`Insufficient stock for product: ${product.name}`);
                }

                // Update stock
                product.stock -= item.quantity;
                await transactionalEntityManager.save(product);

                // Create Sale Item
                const saleItem = new SaleItemEntity();
                saleItem.product_id = product.id;
                saleItem.product_name = product.name;
                saleItem.quantity = item.quantity;
                saleItem.unit_price = Number(item.unit_price) || Number(product.sale_price);
                saleItem.total_price = saleItem.quantity * saleItem.unit_price;

                saleItems.push(saleItem);
                calculatedSubtotal += saleItem.total_price;
            }

            const discountAmount = saleData.discount_amount || 0;
            if (discountAmount < 0) {
                throw new Error("Discount amount cannot be negative");
            }
            if (discountAmount > calculatedSubtotal) {
                throw new Error("Discount cannot be greater than the subtotal");
            }

            const finalTotal = calculatedSubtotal - discountAmount;

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
            // For credit, default amount_paid is 0 if not provided
            sale.amount_paid = saleData.amount_paid ?? (isCredit ? 0 : finalTotal);
            sale.change_given = saleData.change_given || 0;
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
                customer.balance = Number(customer.balance) + finalTotal;
                await transactionalEntityManager.save(CustomerEntity, customer);
            }
            
            return { success: true, saleId: savedSale.id };
        });
    }

    async payDebt(
        customerId: string,
        amount: number,
        shiftId?: string,
        paymentMethod: 'cash' | 'transfer' = 'cash'
    ): Promise<{ success: true; newBalance: number; payment: DebtPaymentEntity }> {
        if (amount <= 0) {
            throw new Error("El monto debe ser mayor a 0");
        }

        return await this.dataSource.transaction(async (transactionalEntityManager) => {
            const customer = await transactionalEntityManager.findOneBy(CustomerEntity, { id: customerId });
            if (!customer) {
                throw new Error("Cliente no encontrado");
            }

            const currentBalance = Number(customer.balance);
            if (currentBalance <= 0) {
                throw new Error("Este cliente no tiene deuda pendiente");
            }

            if (amount > currentBalance) {
                throw new Error(`El monto excede la deuda pendiente de RD$${currentBalance.toFixed(2)}`);
            }

            // Update global customer balance
            customer.balance = currentBalance - amount;
            await transactionalEntityManager.save(CustomerEntity, customer);

            // Record the debt payment linked to the current shift
            const debtPayment = this.debtPaymentRepository.create({
                customer_id: customerId,
                shift_id: shiftId || undefined,
                amount,
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

            let remainingAmount = amount;

            for (const sale of pendingSales) {
                if (remainingAmount <= 0) break;

                const totalOwedForSale = Number(sale.total_amount);
                const alreadyPaid = Number(sale.amount_paid || 0);
                const pendingForSale = totalOwedForSale - alreadyPaid;

                if (pendingForSale <= 0) continue;

                if (remainingAmount >= pendingForSale) {
                    // Sale fully paid
                    sale.amount_paid = totalOwedForSale;
                    sale.status = 'paid';
                    remainingAmount -= pendingForSale;
                } else {
                    // Sale partially paid
                    sale.amount_paid = alreadyPaid + remainingAmount;
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
        return this.saleRepository.find({
            order: { created_at: 'DESC' },
            take: limit,
            relations: ['user', 'items', 'customer']
        });
    }

    async getRecentSales(limit: number = 5): Promise<SaleEntity[]> {
        return this.saleRepository.find({
            order: { created_at: 'DESC' },
            take: limit,
            relations: ['user']
        });
    }

    async getSalesByShiftId(shiftId: string): Promise<SaleEntity[]> {
        return this.saleRepository.find({
            where: { shift_id: shiftId },
            order: { created_at: 'DESC' },
            relations: ['items']
        });
    }

    async findOne(id: string): Promise<SaleEntity | null> {
        return this.saleRepository.findOne({
            where: { id },
            relations: ['items', 'user', 'customer']
        });
    }

    async findAll(limit: number = 100): Promise<SaleEntity[]> {
        return this.saleRepository.find({
            order: { created_at: "DESC" },
            take: limit
        });
    }

    async getSaleItems(saleId: string): Promise<any[]> {
        const sale = await this.saleRepository.findOne({
            where: { id: saleId },
            relations: ['items', 'items.product']
        });
        
        if (!sale) return [];

        return sale.items.map(item => ({
            ...item,
            price_at_sale: Number(item.unit_price) || 0
        }));
    }
}
