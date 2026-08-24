import { AppDataSource } from "@main/config/data-source";
import { Sale as SaleEntity } from "@main/modules/sales/entities/sale.entity";
import { SaleItem as SaleItemEntity } from "@main/modules/sales/entities/sale-item.entity";
import { Shift as ShiftEntity } from "@main/modules/shifts/entities/shift.entity";
// import { Between } from "typeorm";

interface SalesMetrics {
    totalAmount: number;
    netProfit: number;
    totalCost: number;
    averageMargin: number;
    totalSalesCount: number;
    totalItemsSold: number;
    averageTicket: number;
}

export class ReportsService {
    // Basic implementation using QueryBuilder to replicate complex SQL from reports.js
    
    private formatDate(date: Date): string {
        // SQLite expects YYYY-MM-DD HH:MM:SS
        return date.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
    }

    async getTotalSalesMetrics(startDate: Date | null, endDate: Date | null): Promise<{ current: SalesMetrics, previous?: SalesMetrics }> {
        const current = await this.calculateMetrics(startDate, endDate);
        
        let previous: SalesMetrics | undefined;
        if (startDate && endDate) {
            const duration = endDate.getTime() - startDate.getTime();
            const prevStart = new Date(startDate.getTime() - duration);
            const prevEnd = new Date(endDate.getTime() - duration);
            previous = await this.calculateMetrics(prevStart, prevEnd);
        }

        return { current, previous };
    }

    private async calculateMetrics(startDate: Date | null, endDate: Date | null) {
        // Query 1: Sales aggregates (no joins to avoid row duplication)
        // Voided sales must never count toward revenue/metrics
        const saleQuery = AppDataSource.getRepository(SaleEntity).createQueryBuilder("sale")
            .where("sale.status != 'voided'");

        if (startDate && endDate) {
            saleQuery.andWhere("sale.created_at BETWEEN :start AND :end", {
                start: this.formatDate(startDate),
                end: this.formatDate(endDate)
            });
        }

        const saleResult = await saleQuery
            .select("SUM(sale.total_amount)", "totalAmount")
            .addSelect("COUNT(sale.id)", "totalSalesCount")
            .getRawOne();

        // Query 2: Items aggregates
        const itemQuery = AppDataSource.getRepository(SaleItemEntity)
            .createQueryBuilder("item")
            .leftJoin("item.sale", "sale")
            .leftJoin("item.product", "product")
            .where("sale.status != 'voided'");

        if (startDate && endDate) {
            itemQuery.andWhere("sale.created_at BETWEEN :start AND :end", {
                start: this.formatDate(startDate), 
                end: this.formatDate(endDate) 
            });
        }

        const itemResult = await itemQuery
            .select("SUM(item.quantity * COALESCE(product.cost_price, 0))", "totalCost")
            .addSelect("SUM(item.quantity)", "totalItemsSold")
            .getRawOne();

        const totalAmount = Number(saleResult?.totalAmount || 0);
        const totalCost = Number(itemResult?.totalCost || 0);
        const netProfit = totalAmount - totalCost;
        const averageMargin = totalAmount > 0 ? (netProfit / totalAmount) * 100 : 0;
        const totalSalesCount = Number(saleResult?.totalSalesCount || 0);
        const totalItemsSold = Number(itemResult?.totalItemsSold || 0);
        const averageTicket = totalSalesCount > 0 ? totalAmount / totalSalesCount : 0;

        return {
            totalAmount,
            totalCost,
            netProfit,
            averageMargin,
            totalSalesCount,
            totalItemsSold,
            averageTicket
        };
    }

    async getTopSellingProducts(startDate: Date | null, endDate: Date | null, limit: number = 5) {
        const query = AppDataSource.getRepository(SaleItemEntity)
            .createQueryBuilder("item")
            .leftJoin("item.sale", "sale")
            .leftJoin("item.product", "product")
            .select("product.name", "productName")
            .addSelect("SUM(item.quantity)", "totalSold")
            .addSelect("SUM(item.total_price)", "totalRevenue")
            .where("sale.status != 'voided'")
            .groupBy("item.product_id")
            .orderBy("totalSold", "DESC")
            .limit(limit);

        if (startDate && endDate) {
            query.andWhere("sale.created_at BETWEEN :start AND :end", {
                start: this.formatDate(startDate), 
                end: this.formatDate(endDate) 
            });
        }

        const results = await query.getRawMany();
        return results.map(r => ({
            ...r,
            totalSold: Number(r.totalSold) || 0,
            totalRevenue: Number(r.totalRevenue) || 0
        }));
    }

    async getSalesOverTime(startDate: Date | null, endDate: Date | null, interval: 'day' | 'week' | 'month' = 'day') {
         const dateFormat = interval === 'month' ? '%Y-%m' : '%Y-%m-%d'; 
         
         const query = AppDataSource.getRepository(SaleEntity)
             .createQueryBuilder("sale")
             .select(`STRFTIME('${dateFormat}', sale.created_at)`, "period")
             .addSelect("SUM(sale.total_amount)", "totalSales")
             .addSelect("COUNT(sale.id)", "totalTransactions")
             .where("sale.status != 'voided'")
             .groupBy("period")
             .orderBy("period", "ASC");

         if (startDate && endDate) {
             query.andWhere("sale.created_at BETWEEN :start AND :end", {
                 start: this.formatDate(startDate),
                 end: this.formatDate(endDate)
             });
         }

         const results = await query.getRawMany();
         return results.map(r => ({
             ...r,
             totalSales: Number(r.totalSales) || 0,
             totalTransactions: Number(r.totalTransactions) || 0
         }));
    }

    async getLeastSellingProducts(startDate: Date | null, endDate: Date | null, limit: number = 5) {
         const query = AppDataSource.getRepository(SaleItemEntity)
             .createQueryBuilder("item")
             .leftJoin("item.sale", "sale")
             .leftJoin("item.product", "product")
             .select("product.name", "productName")
             .addSelect("SUM(item.quantity)", "totalSold")
             .addSelect("SUM(item.total_price)", "totalRevenue")
             .where("sale.status != 'voided'")
             .groupBy("item.product_id")
             .orderBy("totalSold", "ASC")
             .limit(limit);

         if (startDate && endDate) {
            query.andWhere("sale.created_at BETWEEN :start AND :end", {
                start: this.formatDate(startDate),
                end: this.formatDate(endDate)
            });
         }

         const results = await query.getRawMany();
         return results.map(r => ({
             ...r,
             totalSold: Number(r.totalSold) || 0,
             totalRevenue: Number(r.totalRevenue) || 0
         }));
    }

    async getDashboardStats() {
        const today = new Date();
        const startOfDay = new Date(today);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(today);
        endOfDay.setHours(23, 59, 59, 999);
        
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const startOfYesterday = new Date(yesterday);
        startOfYesterday.setHours(0, 0, 0, 0);
        const endOfYesterday = new Date(yesterday);
        endOfYesterday.setHours(23, 59, 59, 999);

        const todayMetrics = await this.calculateMetrics(startOfDay, endOfDay);
        const yesterdayMetrics = await this.calculateMetrics(startOfYesterday, endOfYesterday);

        return {
            today: {
                totalSales: todayMetrics.totalAmount,
                totalTransactions: todayMetrics.totalSalesCount,
                averageTicket: todayMetrics.averageTicket,
                totalItemsSold: todayMetrics.totalItemsSold,
                averageMargin: todayMetrics.averageMargin,
                netProfit: todayMetrics.netProfit
            },
            yesterday: {
                totalSales: yesterdayMetrics.totalAmount,
                totalTransactions: yesterdayMetrics.totalSalesCount,
                averageTicket: yesterdayMetrics.averageTicket,
                totalItemsSold: yesterdayMetrics.totalItemsSold,
                averageMargin: yesterdayMetrics.averageMargin,
                netProfit: yesterdayMetrics.netProfit
            }
        };
    }

    /**
     * Sales grouped by hour for a single day (dashboard "Ventas por Hora").
     * @param dayOffset 0 = today, -1 = yesterday (local time).
     */
    async getSalesByHour(dayOffset: 0 | -1 = 0) {
        const day = new Date();
        day.setDate(day.getDate() + dayOffset);
        const start = new Date(day); start.setHours(0, 0, 0, 0);
        const end = new Date(day); end.setHours(23, 59, 59, 999);

        const rows = await AppDataSource.getRepository(SaleEntity)
            .createQueryBuilder("sale")
            .select("STRFTIME('%H', sale.created_at, 'localtime')", "hour")
            .addSelect("SUM(sale.total_amount)", "total")
            .addSelect("COUNT(sale.id)", "transactions")
            .where("sale.status != 'voided'")
            .andWhere("sale.created_at BETWEEN :start AND :end", {
                start: this.formatDate(start),
                end: this.formatDate(end),
            })
            .groupBy("hour")
            .orderBy("hour", "ASC")
            .getRawMany();

        return rows.map(r => ({
            hour: Number(r.hour),
            total: Number(r.total) || 0,
            transactions: Number(r.transactions) || 0,
        }));
    }

    /** Revenue totals per payment method for today (dashboard "Métodos de Pago"). */
    async getPaymentMethodTotals() {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const end = new Date(); end.setHours(23, 59, 59, 999);

        const rows = await AppDataSource.getRepository(SaleEntity)
            .createQueryBuilder("sale")
            .select("sale.payment_method", "method")
            .addSelect("SUM(sale.total_amount)", "total")
            .addSelect("COUNT(sale.id)", "transactions")
            .where("sale.status != 'voided'")
            .andWhere("sale.created_at BETWEEN :start AND :end", {
                start: this.formatDate(start),
                end: this.formatDate(end),
            })
            .groupBy("sale.payment_method")
            .getRawMany();

        return rows.map(r => ({
            method: String(r.method),
            total: Number(r.total) || 0,
            transactions: Number(r.transactions) || 0,
        }));
    }

    /**
     * Returns summary stats for the currently active shift of a given user.
     * This is the employee-facing dashboard widget — no requirePermission beyond pos:access.
     */
    async getShiftSummary(userId: string): Promise<{
        hasOpenShift: boolean;
        shiftId?: string;
        startTime?: Date;
        totalTransactions: number;
        totalAmount: number;
    }> {
        const shift = await AppDataSource.getRepository(ShiftEntity).findOne({
            where: { user_id: userId, status: 'open' },
        });

        if (!shift) {
            return { hasOpenShift: false, totalTransactions: 0, totalAmount: 0 };
        }

        const result = await AppDataSource.getRepository(SaleEntity)
            .createQueryBuilder('sale')
            .select('COUNT(sale.id)', 'totalTransactions')
            .addSelect('SUM(sale.total_amount)', 'totalAmount')
            .where('sale.shift_id = :shiftId', { shiftId: shift.id })
            .andWhere("sale.status != 'voided'")
            .getRawOne();

        return {
            hasOpenShift: true,
            shiftId: shift.id,
            startTime: shift.start_time,
            totalTransactions: Number(result?.totalTransactions ?? 0),
            totalAmount: Number(result?.totalAmount ?? 0),
        };
    }
}
