const { getDb, runAsync } = require('./connection');

/**
 * Create database indices for reports performance optimization
 * Safe to call multiple times (IF NOT EXISTS)
 */
async function createReportsIndices() {
    try {
        // Array of index creation statements
        const indices = [
            {
                name: 'idx_sales_date',
                sql: 'CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date)'
            },
            {
                name: 'idx_sales_payment_method',
                sql: 'CREATE INDEX IF NOT EXISTS idx_sales_payment_method ON sales(payment_method)'
            },
            {
                name: 'idx_sale_items_sale_id',
                sql: 'CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id)'
            },
            {
                name: 'idx_sale_items_product_id',
                sql: 'CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id)'
            },
            {
                name: 'idx_products_category',
                sql: 'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id)'
            },
            {
                name: 'idx_sales_date_amount',
                sql: 'CREATE INDEX IF NOT EXISTS idx_sales_date_amount ON sales(sale_date, total_amount)'
            },
            {
                name: 'idx_products_name',
                sql: 'CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)'
            },
            {
                name: 'idx_products_sku',
                sql: 'CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku)'
            },
            {
                name: 'idx_shifts_user_id',
                sql: 'CREATE INDEX IF NOT EXISTS idx_shifts_user_id ON shifts(user_id)'
            },
            {
                name: 'idx_shifts_start_time',
                sql: 'CREATE INDEX IF NOT EXISTS idx_shifts_start_time ON shifts(start_time)'
            },
            {
                name: 'idx_sales_shift_id',
                sql: 'CREATE INDEX IF NOT EXISTS idx_sales_shift_id ON sales(shift_id)'
            }
        ];

        // Create all indices in parallel
        await Promise.all(
            indices.map(async ({ name, sql }) => {
                try {
                    await runAsync(sql);
                    console.log(`Index ${name} created successfully or already exists.`);
                } catch (error) {
                    console.error(`Error creating index ${name}:`, error.message);
                    throw error;
                }
            })
        );

        console.log('All reports indices created successfully.');
    } catch (error) {
        console.error('Error creating reports indices:', error);
        throw error;
    }
}

module.exports = {
    createReportsIndices
};
