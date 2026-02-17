import { AppDataSource } from "@main/config/data-source";
import { Sale as SaleEntity } from "@main/modules/sales/entities/sale.entity";
import { SaleItem as SaleItemEntity } from "@main/modules/sales/entities/sale-item.entity";
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
        const query = AppDataSource.getRepository(SaleEntity)
            .createQueryBuilder("sale")
            .leftJoin("sale.items", "item") 
            .leftJoin("item.product", "product");

        if (startDate && endDate) {
            query.where("sale.created_at BETWEEN :start AND :end", { 
                start: this.formatDate(startDate), 
                end: this.formatDate(endDate) 
            });
        }
        
        const result = await query
            .select("SUM(sale.total_amount)", "totalAmount")
            .addSelect("SUM(item.quantity * COALESCE(product.cost_price, 0))", "totalCost")
            .addSelect("COUNT(DISTINCT sale.id)", "totalSalesCount")
            .addSelect("SUM(item.quantity)", "totalItemsSold")
            .getRawOne();

        const totalAmount = Number(result.totalAmount) || 0;
        const totalCost = Number(result.totalCost) || 0;
        const netProfit = totalAmount - totalCost;
        const averageMargin = totalAmount > 0 ? (netProfit / totalAmount) * 100 : 0;
        const totalSalesCount = Number(result.totalSalesCount) || 0;
        const totalItemsSold = Number(result.totalItemsSold) || 0;
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
            .groupBy("item.product_id")
            .orderBy("totalSold", "DESC")
            .limit(limit);

        if (startDate && endDate) {
            query.where("sale.created_at BETWEEN :start AND :end", { 
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
             .groupBy("period")
             .orderBy("period", "ASC");

         if (startDate && endDate) {
             query.where("sale.created_at BETWEEN :start AND :end", {
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
             .groupBy("item.product_id")
             .orderBy("totalSold", "ASC") 
             .limit(limit);

         if (startDate && endDate) {
            query.where("sale.created_at BETWEEN :start AND :end", {
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
                totalItemsSold: todayMetrics.totalItemsSold
            },
            yesterday: {
                totalSales: yesterdayMetrics.totalAmount,
                totalTransactions: yesterdayMetrics.totalSalesCount,
                averageTicket: yesterdayMetrics.averageTicket,
                totalItemsSold: yesterdayMetrics.totalItemsSold
            }
        };
    }
}

