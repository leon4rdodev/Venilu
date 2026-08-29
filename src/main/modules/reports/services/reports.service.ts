import { AppDataSource } from "@main/config/data-source";
import { Sale as SaleEntity } from "@main/modules/sales/entities/sale.entity";
import { SaleItem as SaleItemEntity } from "@main/modules/sales/entities/sale-item.entity";
import { Shift as ShiftEntity } from "@main/modules/shifts/entities/shift.entity";
import { DebtPayment as DebtPaymentEntity } from "@main/modules/sales/entities/debt-payment.entity";
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
        // INCOME IS CASH-COLLECTED, not accrued:
        //   - non-credit sales count at their total (paid at the register)
        //   - credit sales count ONLY as the customer pays (debt payments, at
        //     payment date), and refunds from voided collected sales subtract.
        // Counts/units/cost stay on delivered basis (all non-voided sales).
        const saleQuery = AppDataSource.getRepository(SaleEntity).createQueryBuilder("sale")
            .where("sale.status != 'voided'");

        const debtQuery = AppDataSource.getRepository(DebtPaymentEntity).createQueryBuilder("dp");

        if (startDate && endDate) {
            const range = { start: this.formatDate(startDate), end: this.formatDate(endDate) };
            saleQuery.andWhere("sale.created_at BETWEEN :start AND :end", range);
            debtQuery.andWhere("dp.created_at BETWEEN :start AND :end", range);
        }

        const [saleResult, debtResult] = await Promise.all([
            saleQuery
                .select("SUM(CASE WHEN sale.payment_method != 'credit' THEN sale.total_amount ELSE 0 END)", "collectedSales")
                .addSelect("COUNT(sale.id)", "totalSalesCount")
                .getRawOne(),
            debtQuery
                .select("SUM(CASE WHEN dp.type = 'refund' THEN -dp.amount ELSE dp.amount END)", "collectedDebt")
                .getRawOne(),
        ]);

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

        const totalAmount = Math.round(((Number(saleResult?.collectedSales) || 0) + (Number(debtResult?.collectedDebt) || 0)) * 100) / 100;
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

    /**
     * Shared product ranking query: units, revenue, profit and margin per product.
     * @param direction DESC = top sellers, ASC = least sellers.
     */
    private async getProductRanking(
        startDate: Date | null,
        endDate: Date | null,
        limit: number,
        direction: 'ASC' | 'DESC',
    ) {
        const query = AppDataSource.getRepository(SaleItemEntity)
            .createQueryBuilder("item")
            .leftJoin("item.sale", "sale")
            .leftJoin("item.product", "product")
            .select("product.name", "productName")
            .addSelect("SUM(item.quantity)", "totalSold")
            .addSelect("SUM(item.total_price)", "totalRevenue")
            .addSelect("SUM(item.quantity * COALESCE(product.cost_price, 0))", "totalCost")
            .where("sale.status != 'voided'")
            .groupBy("item.product_id")
            .orderBy("totalSold", direction)
            .limit(limit);

        if (startDate && endDate) {
            query.andWhere("sale.created_at BETWEEN :start AND :end", {
                start: this.formatDate(startDate),
                end: this.formatDate(endDate)
            });
        }

        const results = await query.getRawMany();
        return results.map(r => {
            const totalRevenue = Number(r.totalRevenue) || 0;
            const totalCost = Number(r.totalCost) || 0;
            const totalProfit = totalRevenue - totalCost;
            return {
                productName: r.productName,
                totalSold: Number(r.totalSold) || 0,
                totalRevenue,
                totalProfit,
                margin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
            };
        });
    }

    async getTopSellingProducts(startDate: Date | null, endDate: Date | null, limit: number = 5) {
        return this.getProductRanking(startDate, endDate, limit, 'DESC');
    }

    async getSalesOverTime(startDate: Date | null, endDate: Date | null, interval: 'day' | 'week' | 'month' = 'day') {
         // 'week' previously fell through to daily grouping — %Y-W%W buckets properly.
         const dateFormat = interval === 'month' ? '%Y-%m' : interval === 'week' ? '%Y-W%W' : '%Y-%m-%d';
         const periodExpr = `STRFTIME('${dateFormat}', sale.created_at, 'localtime')`;

         // Income per period is CASH-COLLECTED: non-credit sale totals plus
         // debt payments (net of refunds) landing in that period.
         const query = AppDataSource.getRepository(SaleEntity)
             .createQueryBuilder("sale")
             .select(periodExpr, "period")
             .addSelect("SUM(CASE WHEN sale.payment_method != 'credit' THEN sale.total_amount ELSE 0 END)", "totalSales")
             .addSelect("COUNT(sale.id)", "totalTransactions")
             .where("sale.status != 'voided'")
             .groupBy("period")
             .orderBy("period", "ASC");

         const debtPeriodExpr = periodExpr.replace(/sale\.created_at/g, "dp.created_at");
         const debtQuery = AppDataSource.getRepository(DebtPaymentEntity)
             .createQueryBuilder("dp")
             .select(debtPeriodExpr, "period")
             .addSelect("SUM(CASE WHEN dp.type = 'refund' THEN -dp.amount ELSE dp.amount END)", "collected")
             .groupBy("period");

         // Cost per period comes from items (separate query — joining would
         // duplicate sale rows and inflate totalSales).
         const costQuery = AppDataSource.getRepository(SaleItemEntity)
             .createQueryBuilder("item")
             .leftJoin("item.sale", "sale")
             .leftJoin("item.product", "product")
             .select(periodExpr, "period")
             .addSelect("SUM(item.quantity * COALESCE(product.cost_price, 0))", "itemCost")
             .where("sale.status != 'voided'")
             .groupBy("period");

         if (startDate && endDate) {
             const range = { start: this.formatDate(startDate), end: this.formatDate(endDate) };
             query.andWhere("sale.created_at BETWEEN :start AND :end", range);
             costQuery.andWhere("sale.created_at BETWEEN :start AND :end", range);
             debtQuery.andWhere("dp.created_at BETWEEN :start AND :end", range);
         }

         const [results, costRows, debtRows] = await Promise.all([
             query.getRawMany(), costQuery.getRawMany(), debtQuery.getRawMany(),
         ]);
         const costByPeriod = new Map<string, number>(
             costRows.map(r => [String(r.period), Number(r.itemCost) || 0]),
         );
         const collectedByPeriod = new Map<string, number>(
             debtRows.map(r => [String(r.period), Number(r.collected) || 0]),
         );

         // Merge: a period can exist only in debt payments (collection day with
         // no sales) — those rows must still show up.
         const byPeriod = new Map<string, { totalSales: number; totalTransactions: number }>();
         for (const r of results) {
             byPeriod.set(String(r.period), {
                 totalSales: Number(r.totalSales) || 0,
                 totalTransactions: Number(r.totalTransactions) || 0,
             });
         }
         for (const [period, collected] of collectedByPeriod) {
             const row = byPeriod.get(period) ?? { totalSales: 0, totalTransactions: 0 };
             row.totalSales = Math.round((row.totalSales + collected) * 100) / 100;
             byPeriod.set(period, row);
         }

         // Profit = collected − cost, matching calculateMetrics' definition
         return [...byPeriod.entries()]
             .sort(([a], [b]) => a.localeCompare(b))
             .map(([period, row]) => ({
                 period,
                 totalSales: row.totalSales,
                 totalTransactions: row.totalTransactions,
                 totalProfit: Math.round((row.totalSales - (costByPeriod.get(period) ?? 0)) * 100) / 100,
             }));
    }

    async getLeastSellingProducts(startDate: Date | null, endDate: Date | null, limit: number = 5) {
        return this.getProductRanking(startDate, endDate, limit, 'ASC');
    }

    /**
     * MONEY RECEIVED per payment method for an arbitrary date range:
     *   - cash/card/transfer: their sales plus debt collections by that method
     *     (refunds subtract from cash)
     *   - 'credit': the OUTSTANDING amount of credit sales in the range —
     *     pending money, not income.
     */
    async getPaymentMethodBreakdown(startDate: Date | null, endDate: Date | null) {
        const range = startDate && endDate
            ? { start: this.formatDate(startDate), end: this.formatDate(endDate) }
            : null;

        const salesQuery = AppDataSource.getRepository(SaleEntity)
            .createQueryBuilder("sale")
            .select("sale.payment_method", "method")
            .addSelect("SUM(sale.total_amount)", "total")
            .addSelect("COUNT(sale.id)", "transactions")
            .where("sale.status != 'voided'")
            .andWhere("sale.payment_method != 'credit'")
            .groupBy("sale.payment_method");

        const debtQuery = AppDataSource.getRepository(DebtPaymentEntity)
            .createQueryBuilder("dp")
            .select("dp.payment_method", "method")
            .addSelect("SUM(CASE WHEN dp.type = 'refund' THEN -dp.amount ELSE dp.amount END)", "collected")
            .addSelect("SUM(CASE WHEN dp.type = 'refund' THEN 0 ELSE 1 END)", "payments")
            .groupBy("dp.payment_method");

        const creditQuery = AppDataSource.getRepository(SaleEntity)
            .createQueryBuilder("sale")
            .select("SUM(sale.total_amount - COALESCE(sale.amount_paid, 0))", "pending")
            .addSelect("COUNT(sale.id)", "transactions")
            .where("sale.status != 'voided'")
            .andWhere("sale.payment_method = 'credit'");

        if (range) {
            salesQuery.andWhere("sale.created_at BETWEEN :start AND :end", range);
            debtQuery.andWhere("dp.created_at BETWEEN :start AND :end", range);
            creditQuery.andWhere("sale.created_at BETWEEN :start AND :end", range);
        }

        const [salesRows, debtRows, creditRow] = await Promise.all([
            salesQuery.getRawMany(), debtQuery.getRawMany(), creditQuery.getRawOne(),
        ]);

        const buckets = new Map<string, { total: number; transactions: number }>();
        for (const r of salesRows) {
            buckets.set(String(r.method), {
                total: Number(r.total) || 0,
                transactions: Number(r.transactions) || 0,
            });
        }
        for (const r of debtRows) {
            const method = String(r.method);
            const bucket = buckets.get(method) ?? { total: 0, transactions: 0 };
            bucket.total = Math.round((bucket.total + (Number(r.collected) || 0)) * 100) / 100;
            bucket.transactions += Number(r.payments) || 0;
            buckets.set(method, bucket);
        }
        const creditCount = Number(creditRow?.transactions) || 0;
        if (creditCount > 0) {
            buckets.set('credit', {
                total: Math.max(0, Math.round((Number(creditRow?.pending) || 0) * 100) / 100),
                transactions: creditCount,
            });
        }

        return [...buckets.entries()]
            .map(([method, b]) => ({ method, total: b.total, transactions: b.transactions }))
            .sort((a, b) => b.total - a.total);
    }

    /** Revenue, units and profit grouped by product category for the range. */
    async getCategoryBreakdown(startDate: Date | null, endDate: Date | null) {
        const query = AppDataSource.getRepository(SaleItemEntity)
            .createQueryBuilder("item")
            .leftJoin("item.sale", "sale")
            .leftJoin("item.product", "product")
            .leftJoin("product.category", "category")
            .select("COALESCE(category.name, 'Sin categoría')", "categoryName")
            .addSelect("SUM(item.quantity)", "totalSold")
            .addSelect("SUM(item.total_price)", "totalRevenue")
            .addSelect("SUM(item.quantity * COALESCE(product.cost_price, 0))", "totalCost")
            .where("sale.status != 'voided'")
            .groupBy("categoryName")
            .orderBy("totalRevenue", "DESC");

        if (startDate && endDate) {
            query.andWhere("sale.created_at BETWEEN :start AND :end", {
                start: this.formatDate(startDate),
                end: this.formatDate(endDate)
            });
        }

        const rows = await query.getRawMany();
        return rows.map(r => {
            const totalRevenue = Number(r.totalRevenue) || 0;
            const totalCost = Number(r.totalCost) || 0;
            const totalProfit = totalRevenue - totalCost;
            return {
                categoryName: String(r.categoryName),
                totalSold: Number(r.totalSold) || 0,
                totalRevenue,
                totalProfit,
                margin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
            };
        });
    }

    /** Registered customers ranked by spend in the range (walk-ins excluded). */
    async getTopCustomers(startDate: Date | null, endDate: Date | null, limit: number = 5) {
        const query = AppDataSource.getRepository(SaleEntity)
            .createQueryBuilder("sale")
            .leftJoin("sale.customer", "customer")
            .select("sale.customer_id", "customerId")
            .addSelect("COALESCE(customer.name, sale.customer_name)", "customerName")
            .addSelect("SUM(sale.total_amount)", "totalSpent")
            .addSelect("COUNT(sale.id)", "totalTransactions")
            .where("sale.status != 'voided'")
            .andWhere("sale.customer_id IS NOT NULL")
            .groupBy("sale.customer_id")
            .orderBy("totalSpent", "DESC")
            .limit(limit);

        if (startDate && endDate) {
            query.andWhere("sale.created_at BETWEEN :start AND :end", {
                start: this.formatDate(startDate),
                end: this.formatDate(endDate)
            });
        }

        const rows = await query.getRawMany();
        return rows.map(r => {
            const totalSpent = Number(r.totalSpent) || 0;
            const totalTransactions = Number(r.totalTransactions) || 0;
            return {
                customerId: String(r.customerId),
                customerName: String(r.customerName ?? 'Cliente'),
                totalSpent,
                totalTransactions,
                averageTicket: totalTransactions > 0 ? totalSpent / totalTransactions : 0,
            };
        });
    }

    /**
     * Everything the exported report needs, recalculated server-side so the
     * PDF/CSV never trusts renderer-provided figures.
     */
    async getFullReport(startDate: Date | null, endDate: Date | null, interval: 'day' | 'week' | 'month' = 'day') {
        const [metrics, salesOverTime, topSellingProducts, leastSellingProducts, paymentBreakdown, categoryBreakdown, topCustomers] =
            await Promise.all([
                this.getTotalSalesMetrics(startDate, endDate),
                this.getSalesOverTime(startDate, endDate, interval),
                this.getTopSellingProducts(startDate, endDate, 10),
                this.getLeastSellingProducts(startDate, endDate, 10),
                this.getPaymentMethodBreakdown(startDate, endDate),
                this.getCategoryBreakdown(startDate, endDate),
                this.getTopCustomers(startDate, endDate, 10),
            ]);

        return { metrics, salesOverTime, topSellingProducts, leastSellingProducts, paymentBreakdown, categoryBreakdown, topCustomers };
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

        const range = { start: this.formatDate(start), end: this.formatDate(end) };

        // Cash-collected per hour: non-credit sales + debt collections (signed)
        const [saleRows, debtRows] = await Promise.all([
            AppDataSource.getRepository(SaleEntity)
                .createQueryBuilder("sale")
                .select("STRFTIME('%H', sale.created_at, 'localtime')", "hour")
                .addSelect("SUM(CASE WHEN sale.payment_method != 'credit' THEN sale.total_amount ELSE 0 END)", "total")
                .addSelect("COUNT(sale.id)", "transactions")
                .where("sale.status != 'voided'")
                .andWhere("sale.created_at BETWEEN :start AND :end", range)
                .groupBy("hour")
                .getRawMany(),
            AppDataSource.getRepository(DebtPaymentEntity)
                .createQueryBuilder("dp")
                .select("STRFTIME('%H', dp.created_at, 'localtime')", "hour")
                .addSelect("SUM(CASE WHEN dp.type = 'refund' THEN -dp.amount ELSE dp.amount END)", "collected")
                .where("dp.created_at BETWEEN :start AND :end", range)
                .groupBy("hour")
                .getRawMany(),
        ]);

        const byHour = new Map<number, { total: number; transactions: number }>();
        for (const r of saleRows) {
            byHour.set(Number(r.hour), { total: Number(r.total) || 0, transactions: Number(r.transactions) || 0 });
        }
        for (const r of debtRows) {
            const hour = Number(r.hour);
            const row = byHour.get(hour) ?? { total: 0, transactions: 0 };
            row.total = Math.round((row.total + (Number(r.collected) || 0)) * 100) / 100;
            byHour.set(hour, row);
        }

        return [...byHour.entries()]
            .sort(([a], [b]) => a - b)
            .map(([hour, row]) => ({ hour, total: row.total, transactions: row.transactions }));
    }

    /** Money received per payment method for today (dashboard "Métodos de Pago"). */
    async getPaymentMethodTotals() {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const end = new Date(); end.setHours(23, 59, 59, 999);
        return this.getPaymentMethodBreakdown(start, end);
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
