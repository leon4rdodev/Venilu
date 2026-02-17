const { getDb, runAsync, allAsync } = require('./connection');

// Helper to get a single row
function getAsync(sql, params = []) {
    const db = getDb();
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

/**
 * Get products with pagination, search, and filtering
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (1-indexed)
 * @param {number} options.pageSize - Items per page
 * @param {string} options.search - Search query for product name
 * @param {string} options.category - Category filter ('all' for no filter)
 * @param {string} options.sortBy - Column to sort by
 * @param {string} options.sortOrder - Sort order (ASC or DESC)
 * @returns {Promise<Object>} Paginated results
 */
async function getProducts(options = {}) {
    const {
        page = 1,
        pageSize = 50,
        search = '',
        category = 'all',
        sortBy = 'name',
        sortOrder = 'ASC'
    } = options;

    // Validate and sanitize inputs
    const validPage = Math.max(1, parseInt(page) || 1);
    const validPageSize = Math.min(100, Math.max(10, parseInt(pageSize) || 50));
    const validSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const validSortBy = ['name', 'category', 'purchase_price', 'sale_price', 'stock'].includes(sortBy) ? sortBy : 'name';
    const offset = (validPage - 1) * validPageSize;

    try {
        // Build WHERE clause
        const whereClauses = [];
        const params = [];

        if (search) {
            whereClauses.push('p.name LIKE ?');
            params.push(`%${search}%`);
        }

        if (category && category !== 'all') {
            whereClauses.push('p.category_id = ?');
            params.push(category);
        }

        const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Get total count first
        const countQuery = `SELECT COUNT(*) as total FROM products p ${whereClause}`;
        const countResult = await getAsync(countQuery, params);
        const total = countResult.total;
        const totalPages = Math.ceil(total / validPageSize);

        // Get paginated products with category name and sales status
        const dataQuery = `
            SELECT 
                p.id, 
                p.name, 
                p.category_id, 
                c.name as category, 
                p.purchase_price, 
                p.sale_price, 
                p.purchase_price, 
                p.sale_price, 
                p.stock,
                p.sku,
                p.min_stock,
                (SELECT 1 FROM sale_items si WHERE si.product_id = p.id LIMIT 1) as has_sales
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            ${whereClause}
            ORDER BY p.${validSortBy} ${validSortOrder}
            LIMIT ? OFFSET ?
        `;

        const rows = await allAsync(dataQuery, [...params, validPageSize, offset]);

        return {
            success: true,
            products: rows,
            pagination: {
                currentPage: validPage,
                pageSize: validPageSize,
                totalItems: total,
                totalPages: totalPages,
                hasNextPage: validPage < totalPages,
                hasPreviousPage: validPage > 1
            }
        };
    } catch (error) {
        console.error('Error getting products:', error);
        return { success: false, message: 'Database error getting products.' };
    }
}

/**
 * Get all products (backwards compatibility - returns first 1000)
 */
function getAllProducts() {
    return getProducts({ page: 1, pageSize: 1000 });
}

async function createProduct(productData) {
    try {
        const { name, category_id, purchase_price, sale_price, stock, sku, min_stock } = productData;
        const result = await runAsync(
            'INSERT INTO products (name, category_id, purchase_price, sale_price, stock, sku, min_stock) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [name, category_id, purchase_price, sale_price, stock, sku, min_stock || 5]
        );

        return {
            success: true,
            product: { id: result.lastID, name, category_id, purchase_price, sale_price, stock, sku, min_stock }
        };
    } catch (error) {
        console.error('Error creating product:', error);
        return { success: false, message: 'Error creating product.' };
    }
}

async function updateProduct(productId, productData) {
    try {
        const { name, category_id, purchase_price, sale_price, stock, sku, min_stock } = productData;
        await runAsync(
            'UPDATE products SET name = ?, category_id = ?, purchase_price = ?, sale_price = ?, stock = ?, sku = ?, min_stock = ? WHERE id = ?',
            [name, category_id, purchase_price, sale_price, stock, sku, min_stock, productId]
        );

        return { success: true };
    } catch (error) {
        console.error('Error updating product:', error);
        return { success: false, message: 'Error updating product.' };
    }
}

async function deleteProduct(productId) {
    try {
        await runAsync('DELETE FROM products WHERE id = ?', [productId]);
        return { success: true };
    } catch (error) {
        console.error('Error deleting product:', error);
        if (error.code === 'SQLITE_CONSTRAINT' || error.message.includes('FOREIGN KEY constraint failed')) {
            return { 
                success: false, 
                message: 'No se puede eliminar el producto porque tiene ventas asociadas. Considere deshabilitarlo o cambiar el stock a 0.' 
            };
        }
        return { success: false, message: 'Error eliminando el producto.', error: error.message };
    }
}

async function getLowStockProducts(limit = 5) {
    try {
        const rows = await allAsync(
            'SELECT name, stock, min_stock FROM products WHERE stock <= min_stock AND stock > 0 ORDER BY stock ASC LIMIT ?',
            [limit]
        );
        return { success: true, products: rows };
    } catch (error) {
        console.error('Error getting low stock products:', error);
        return { success: false, message: 'Database error.' };
    }
}

/**
 * Get products optimized for POS (Point of Sale)
 * Only returns necessary fields and includes stock status indicator
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (1-indexed)
 * @param {number} options.pageSize - Items per page (default 20 for POS grid)
 * @param {string} options.search - Search query for product name
 * @param {string} options.category - Category filter
 * @param {string} options.sortBy - Column to sort by  
 * @param {string} options.sortOrder - Sort order (ASC or DESC)
 * @returns {Promise<Object>} Paginated results with POS-specific data
 */
async function getProductsForPOS(options = {}) {
    const {
        page = 1,
        pageSize = 20,
        search = '',
        category = 'all',
        sortBy = 'name',
        sortOrder = 'ASC'
    } = options;

    // Validate and sanitize inputs
    const validPage = Math.max(1, parseInt(page) || 1);
    const validPageSize = Math.min(100, Math.max(10, parseInt(pageSize) || 20));
    const validSortOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const validSortBy = ['name', 'category', 'sale_price', 'stock'].includes(sortBy) ? sortBy : 'name';
    const offset = (validPage - 1) * validPageSize;

    try {
        // Build WHERE clause
        const whereClauses = [];
        const params = [];

        if (search) {
            whereClauses.push('p.name LIKE ?');
            params.push(`%${search}%`);
        }

        if (category && category !== 'all') {
            whereClauses.push('p.category_id = ?');
            params.push(category);
        }

        const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Get total count first
        const countQuery = `SELECT COUNT(*) as total FROM products p ${whereClause}`;
        const countResult = await getAsync(countQuery, params);
        const total = countResult.total;
        const totalPages = Math.ceil(total / validPageSize);

        // Get paginated products (only POS-relevant fields)
        const dataQuery = `
            SELECT 
                p.id, 
                p.name, 
                p.category_id,
                c.name as category, 
                p.sale_price, 
                p.stock,
                p.sku,
                p.min_stock,
                CASE 
                    WHEN p.stock = 0 THEN 'out_of_stock'
                    WHEN p.stock <= p.min_stock THEN 'low_stock'
                    ELSE 'in_stock'
                END as stock_status
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            ${whereClause}
            ORDER BY p.${validSortBy} ${validSortOrder}
            LIMIT ? OFFSET ?
        `;

        const rows = await allAsync(dataQuery, [...params, validPageSize, offset]);

        return {
            success: true,
            products: rows,
            pagination: {
                currentPage: validPage,
                pageSize: validPageSize,
                totalItems: total,
                totalPages: totalPages,
                hasNextPage: validPage < totalPages,
                hasPreviousPage: validPage > 1
            }
        };
    } catch (error) {
        console.error('Error getting products for POS:', error);
        return { success: false, message: 'Database error getting products.' };
    }
}

/**
 * Create database indices for performance (safe to call multiple times)
 */
async function createProductIndices() {
    try {
        // Create index on product name for search performance
        await runAsync('CREATE INDEX IF NOT EXISTS idx_products_name ON products(name)');
        // Create index on product sku for search performance
        await runAsync('CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku)');
        console.log('Product name and SKU indices created successfully or already exists.');

        // Note: category_id index is created in createProductsTable in connection.js

        console.log('All product indices created successfully');
    } catch (error) {
        console.error('Error creating product indices:', error);
        throw error;
    }
}

/**
 * Get inventory statistics across ALL products (not paginated)
 * Uses SQL aggregation so stats are always accurate regardless of page size
 */
async function getInventoryStats() {
    try {
        const statsSql = `
            SELECT
                COUNT(*) as totalProducts,
                COALESCE(SUM(purchase_price * stock), 0) as totalStockValue,
                SUM(CASE WHEN stock > 0 AND stock <= min_stock THEN 1 ELSE 0 END) as lowStockProducts,
                SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END) as outOfStockProducts
            FROM products
        `;
        const rows = await allAsync(statsSql, []);
        const stats = rows[0] || {};

        return {
            success: true,
            stats: {
                totalProducts: stats.totalProducts || 0,
                totalStockValue: stats.totalStockValue || 0,
                lowStockProducts: stats.lowStockProducts || 0,
                outOfStockProducts: stats.outOfStockProducts || 0,
            }
        };
    } catch (error) {
        console.error('Error getting inventory stats:', error);
        return { success: false, message: 'Database error getting inventory stats.' };
    }
}

module.exports = {
    getProducts,
    getAllProducts,
    getProductsForPOS,
    createProduct,
    updateProduct,
    deleteProduct,
    getLowStockProducts,
    getInventoryStats,
    createProductIndices,
};
