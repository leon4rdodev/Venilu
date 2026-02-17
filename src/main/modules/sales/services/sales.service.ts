import { AppDataSource } from "@main/config/data-source";
import { Sale as SaleEntity } from "@main/modules/sales/entities/sale.entity";
import { SaleItem as SaleItemEntity } from "@main/modules/sales/entities/sale-item.entity";
import { Product as ProductEntity } from "@main/modules/products/entities/product.entity";
import { Shift as ShiftEntity } from "@main/modules/shifts/entities/shift.entity";
import { Repository, DataSource } from "typeorm";
// import { Sale as SharedSale } from "@shared/types/models";

interface ProcessSaleData {
    user_id: string;
    shift_id: string;
    payment_method: 'cash' | 'card' | 'transfer';
    total_amount?: number; // Optional as we can calculate it
}

interface SaleItemInput {
    product_id: string;
    quantity: number;
    unit_price?: number; // Optional, can fetch from DB
}

export class SalesService {
    private saleRepository: Repository<SaleEntity>;
    private shiftRepository: Repository<ShiftEntity>;
    private dataSource: DataSource;

    constructor() {
        this.dataSource = AppDataSource;
        this.saleRepository = AppDataSource.getRepository(SaleEntity);
        this.shiftRepository = AppDataSource.getRepository(ShiftEntity);
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

        return await this.dataSource.transaction(async (transactionalEntityManager) => {
            let totalAmount = 0;
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
                saleItem.unit_price = Number(item.unit_price) || Number(product.sale_price); // Use provided price or current price
                saleItem.total_price = saleItem.quantity * saleItem.unit_price;

                saleItems.push(saleItem);
                totalAmount += saleItem.total_price;
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

            // Create Sale
            const sale = new SaleEntity();
            sale.id = saleId;
            sale.user_id = saleData.user_id;
            sale.shift_id = saleData.shift_id;
            sale.payment_method = saleData.payment_method;
            sale.total_amount = totalAmount;
            sale.items = saleItems;

            const savedSale = await transactionalEntityManager.save(SaleEntity, sale);
            
            return { success: true, saleId: savedSale.id };
        });
    }

    async getSales(limit: number = 50): Promise<SaleEntity[]> {
        return this.saleRepository.find({
            order: { created_at: 'DESC' },
            take: limit,
            relations: ['user', 'items']
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
            relations: ['items', 'user']
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
            price_at_sale: Number(item.unit_price) || 0 // Map unit_price to price_at_sale for frontend
        }));
    }
}
