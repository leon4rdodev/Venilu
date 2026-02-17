// electron/db/reports.js
const { getDb, runAsync, allAsync } = require('./connection');
const { reportsCache } = require('./reports-cache');

// Constants
const MAX_DATE_RANGE_DAYS = 90;

// Helper to format dates for SQL queries (must match stored ISO format)
const formatDateTime = (date) => {
    return date.toISOString();
};

// Helper to validate date range
const validateDateRange = (startDate, endDate) => {
    if (!startDate || !endDate) {
        return { valid: true };
    }

    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > MAX_DATE_RANGE_DAYS) {
        return {
            valid: false,
            error: `Rango de fechas demasiado grande. Máximo ${MAX_DATE_RANGE_DAYS} días permitidos.`,
            maxDays: MAX_DATE_RANGE_DAYS
        };
    }

    return { valid: true };
};

// Helper function to fetch metrics for a given date range
// Uses separate queries to avoid JOIN inflation (sale_items multiplying sale totals)
async function fetchMetricsForDateRange(db, startDate, endDate) {
    const dateParams = [];
    let salesDateClause = '';
    let costDateClause = '';

    if (startDate && endDate) {
        const formattedStart = formatDateTime(startDate);
        const formattedEnd = formatDateTime(endDate);
        salesDateClause = 'WHERE sale_date BETWEEN ? AND ?';
        costDateClause = 'WHERE si.sale_id IN (SELECT id FROM sales WHERE sale_date BETWEEN ? AND ?)';
        dateParams.push(formattedStart, formattedEnd);
    }

    // Run both queries in parallel — no shared JOINs, no inflation
    const [salesResult, costResult] = await Promise.all([
        // Query 1: Sales totals (clean, no JOINs)
        allAsync(`
            SELECT
                COALESCE(SUM(total_amount), 0) as totalAmount,
                COUNT(id) as totalTransactions
            FROM sales
            ${salesDateClause}
        `, [...dateParams]),

        // Query 2: Cost metrics from sale_items + products (filtered by subquery)
        allAsync(`
            SELECT
                COALESCE(SUM(si.quantity), 0) as totalItemsSold,
                COALESCE(SUM(si.quantity * p.purchase_price), 0) as totalCost
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            ${costDateClause}
        `, [...dateParams]),
    ]);

    const totalAmount = salesResult[0]?.totalAmount || 0;
    const totalTransactions = salesResult[0]?.totalTransactions || 0;
    const totalItemsSold = costResult[0]?.totalItemsSold || 0;
    const totalCost = costResult[0]?.totalCost || 0;

    const netProfit = totalAmount - totalCost;
    const averageMargin = totalAmount > 0 ? (netProfit / totalAmount) * 100 : 0;

    return {
        totalAmount,
        totalItemsSold,
        totalTransactions,
        netProfit,
        totalCost,
        averageMargin,
    };
}

async function getTotalSalesMetrics(startDate, endDate) {
    // Validate date range
    const validation = validateDateRange(startDate, endDate);
    if (!validation.valid) {
        return { error: validation.error, maxDays: validation.maxDays };
    }

    // Generate cache key
    const cacheKey = reportsCache.generateKey('metrics', {
        start: startDate ? startDate.toISOString() : 'null',
        end: endDate ? endDate.toISOString() : 'null'
    });

    // Check cache
    const cached = reportsCache.get(cacheKey);
    if (cached) {
        console.log('Cache hit for getTotalSalesMetrics');
        return cached;
    }

    const db = getDb();

    // Calculate previous period dates
    let previousStartDate = null;
    let previousEndDate = null;

    if (startDate && endDate) {
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        previousEndDate = new Date(startDate);
        previousEndDate.setDate(startDate.getDate() - 1);
        previousStartDate = new Date(previousEndDate);
        previousStartDate.setDate(previousEndDate.getDate() - diffDays + 1);
    }

    const currentPeriodMetrics = await fetchMetricsForDateRange(db, startDate, endDate);
    const previousPeriodMetrics = await fetchMetricsForDateRange(db, previousStartDate, previousEndDate);

    const result = {
        current: currentPeriodMetrics,
        previous: previousPeriodMetrics,
    };

    // Cache the result
    reportsCache.set(cacheKey, result);
    console.log('Cached result for getTotalSalesMetrics');

    return result;
}

async function getSalesOverTime(startDate, endDate, interval = 'day') {
    // Validate date range
    const validation = validateDateRange(startDate, endDate);
    if (!validation.valid) {
        return { error: validation.error, maxDays: validation.maxDays };
    }

    // Generate cache key
    const cacheKey = reportsCache.generateKey('salesOverTime', {
        start: startDate ? startDate.toISOString() : 'null',
        end: endDate ? endDate.toISOString() : 'null',
        interval
    });

    // Check cache
    const cached = reportsCache.get(cacheKey);
    if (cached) {
        console.log('Cache hit for getSalesOverTime');
        return cached;
    }

    const db = getDb();
    const params = [];
    let dateClause = '';

    if (startDate && endDate) {
        dateClause = 'WHERE sale_date BETWEEN ? AND ?';
        params.push(formatDateTime(startDate), formatDateTime(endDate));
    }

    let groupByClause = '';
    let selectDatePart = '';

    if (interval === 'day') {
        selectDatePart = "STRFTIME('%Y-%m-%d', sale_date, 'localtime') as period";
        groupByClause = "GROUP BY period ORDER BY period";
    } else if (interval === 'week') {
        selectDatePart = "STRFTIME('%Y-W%W', sale_date, 'localtime') as period";
        groupByClause = "GROUP BY period ORDER BY period";
    } else if (interval === 'month') {
        selectDatePart = "STRFTIME('%Y-%m', sale_date, 'localtime') as period";
        groupByClause = "GROUP BY period ORDER BY period";
    } else {
        selectDatePart = "STRFTIME('%Y-%m-%d', sale_date, 'localtime') as period";
        groupByClause = "GROUP BY period ORDER BY period";
    }

    const sql = `
        SELECT
            ${selectDatePart},
            SUM(total_amount) as totalSales,
            COUNT(id) as totalTransactions
        FROM sales
        ${dateClause}
        ${groupByClause}
    `;

    const results = await allAsync(sql, params);

    // Cache the results
    reportsCache.set(cacheKey, results);
    console.log('Cached result for getSalesOverTime');

    return results;
}

async function getTopSellingProducts(startDate, endDate, limit = 5) {
    try {
        const db = getDb();
        const params = [];
        let dateClause = '';

        if (startDate && endDate) {
            dateClause = 'WHERE s.sale_date BETWEEN ? AND ?';
            params.push(formatDateTime(startDate), formatDateTime(endDate));
        }

        const sql = `
            SELECT
                p.name as productName,
                SUM(si.quantity) as totalSold,
                SUM(si.quantity * si.price_at_sale) as totalRevenue
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            JOIN sales s ON si.sale_id = s.id
            ${dateClause}
            GROUP BY p.name
            ORDER BY totalSold DESC
            LIMIT ?
        `;
        params.push(limit);

        const products = await allAsync(sql, params);
        return { success: true, products };
    } catch (error) {
        console.error('Error fetching top selling products:', error);
        return { success: false, products: [], message: error.message };
    }
}

async function getLeastSellingProducts(startDate, endDate, limit = 5) {
    try {
        const db = getDb();
        const params = [];
        let dateClause = '';

        if (startDate && endDate) {
            dateClause = 'WHERE s.sale_date BETWEEN ? AND ?';
            params.push(formatDateTime(startDate), formatDateTime(endDate));
        }

        const sql = `
            SELECT
                p.name as productName,
                SUM(si.quantity) as totalSold,
                SUM(si.quantity * si.price_at_sale) as totalRevenue
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            JOIN sales s ON si.sale_id = s.id
            ${dateClause}
            GROUP BY p.name
            ORDER BY totalSold ASC
            LIMIT ?
        `;
        params.push(limit);

        const products = await allAsync(sql, params);
        return { success: true, products };
    } catch (error) {
        console.error('Error fetching least selling products:', error);
        return { success: false, products: [], message: error.message };
    }
}

async function getDashboardStats() {
    const db = getDb();

    // Get today's date range (start of day to end of day in local time)
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

    // Get yesterday's date range
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
    const yesterdayEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);

    // Helper function to fetch stats for a given date range
    const fetchStatsForDateRange = async (startDate, endDate) => {
        const salesSql = `
            SELECT
                SUM(total_amount) as totalSales,
                COUNT(id) as totalTransactions
            FROM sales
            WHERE sale_date >= ? AND sale_date <= ?
        `;
        const salesResult = await allAsync(salesSql, [startDate.toISOString(), endDate.toISOString()]);

        const itemsSql = `
            SELECT SUM(si.quantity) as totalItemsSold
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            WHERE s.sale_date >= ? AND s.sale_date <= ?
        `;
        const itemsResult = await allAsync(itemsSql, [startDate.toISOString(), endDate.toISOString()]);

        const totalSales = salesResult[0]?.totalSales || 0;
        const totalTransactions = salesResult[0]?.totalTransactions || 0;
        const totalItemsSold = itemsResult[0]?.totalItemsSold || 0;
        const averageTicket = totalTransactions > 0 ? totalSales / totalTransactions : 0;

        return {
            totalSales,
            totalTransactions,
            averageTicket,
            totalItemsSold,
        };
    };

    const [todayStats, yesterdayStats] = await Promise.all([
        fetchStatsForDateRange(todayStart, todayEnd),
        fetchStatsForDateRange(yesterdayStart, yesterdayEnd)
    ]);

    return {
        today: todayStats,
        yesterday: yesterdayStats,
    };
}

const { createReportsIndices } = require('./reports-indices');

module.exports = {
    getTotalSalesMetrics,
    getSalesOverTime,
    getTopSellingProducts,
    getLeastSellingProducts,
    getDashboardStats,
    createReportsIndices,
    reportsCache, // Export cache for manual clearing if needed
};
