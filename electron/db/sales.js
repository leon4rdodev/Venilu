const { getDb, runAsync, allAsync } = require('./connection');

async function processSale(saleData, saleItems) {
    console.log('processSale: Starting transaction for saleData:', saleData, 'saleItems:', saleItems);

    try {
        // Validate shift is active
        const shift = await allAsync('SELECT status FROM shifts WHERE id = ?', [saleData.shift_id]);
        if (!shift || shift.length === 0) {
            return { success: false, message: 'Turno no encontrado.' };
        }
        if (shift[0].status !== 'open') {
            return { success: false, message: 'El turno no está activo. No se pueden procesar ventas.' };
        }

        // Validate payment amounts
        if (saleData.total_amount < 0) { 
             // Allow 0
        }
        if (saleData.total_amount <= 0 && saleData.total_amount !== 0) { // Allow 0 explicitly if needed, but keeping basic check
            // Actually, let's strictly require > 0 for now unless specifically asked to support 0
            if (saleData.total_amount < 0) return { success: false, message: 'El monto total no puede ser negativo.' };
        }
        
        const totalAmount = parseFloat(saleData.total_amount);
        const amountPaid = parseFloat(saleData.amount_paid);

        if (amountPaid < totalAmount) {
            return { success: false, message: 'El monto pagado es insuficiente.' };
        }

        // Generate Unique Short UUID (8 chars)
        let uuid;
        let isUnique = false;
        let attempts = 0;
        
        while (!isUnique && attempts < 10) {
            uuid = require('crypto').randomBytes(4).toString('hex').toUpperCase();
            // Check if UUID exists
            const existing = await allAsync('SELECT id FROM sales WHERE uuid = ?', [uuid]);
            if (!existing || existing.length === 0) {
                isUnique = true;
            } else {
                console.warn(`Collision detected for UUID ${uuid}, retrying...`);
                attempts++;
            }
        }
        
        if (!isUnique) {
             throw new Error('Failed to generate a unique Sale ID after multiple attempts.');
        }

        await runAsync('BEGIN TRANSACTION;');
        console.log('processSale: Transaction begun.');

        try {
            // Insert into sales table
            const saleInsertSql = `INSERT INTO sales (uuid, user_id, shift_id, total_amount, payment_method, amount_paid, change_given, sale_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
            const saleResult = await runAsync(saleInsertSql, [
                uuid,
                saleData.user_id,
                saleData.shift_id,
                totalAmount,
                saleData.payment_method,
                amountPaid,
                saleData.change_given,
                saleData.sale_date
            ]);
            const saleInternalId = saleResult.lastID;
            console.log('processSale: Sale record inserted with ID:', saleInternalId, 'UUID:', uuid);

            // Insert items and update stock ATOMICALLY
            const saleItemInsertSql = `INSERT INTO sale_items (sale_id, product_id, quantity, price_at_sale) VALUES (?, ?, ?, ?)`;
            const productUpdateStockSql = `UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?`;

            for (const item of saleItems) {
                const updateResult = await runAsync(productUpdateStockSql, [item.quantity, item.product_id, item.quantity]);
                
                if (updateResult.changes === 0) {
                    const product = await allAsync('SELECT id, name, stock FROM products WHERE id = ?', [item.product_id]);
                    if (!product || product.length === 0) {
                         throw new Error(`Producto ID ${item.product_id} no encontrado.`);
                    } else {
                         throw new Error(`Stock insuficiente para '${product[0].name}'. Disponible: ${product[0].stock}, Solicitado: ${item.quantity}`);
                    }
                }

                await runAsync(saleItemInsertSql, [saleInternalId, item.product_id, item.quantity, item.price_at_sale]);
            }

            await runAsync('COMMIT;');
            console.log('processSale: Transaction committed successfully.');
            return { success: true, saleId: uuid }; // Return UUID

        } catch (innerErr) {
            await runAsync('ROLLBACK;');
            console.error('processSale: Transaction failed, rolled back.', innerErr.message);
            throw innerErr; 
        }

    } catch (err) {
        console.error('processSale: Error processing sale:', err.message);
        return { success: false, message: err.message || 'Error procesando la venta.' };
    }
}

async function getSales() {
    try {
        const rows = await allAsync(
            `SELECT s.uuid as id, s.shift_id, s.total_amount, s.payment_method, s.amount_paid, s.change_given, s.sale_date, u.name as user_name
             FROM sales s
             JOIN users u ON s.user_id = u.id
             ORDER BY s.sale_date DESC`,
            []
        );
        return { success: true, sales: rows };
    } catch (error) {
        console.error('Error getting sales:', error);
        return { success: false, message: 'Database error.', error: error.message };
    }
}

async function getSaleItems(saleIdOrUuid) {
    try {
        // Handle lookup by UUID or ID (if legacy/internal usage)
        // Assume frontend sends UUID.
        let saleInternalId = saleIdOrUuid;

        if (typeof saleIdOrUuid === 'string') { // Handle UUID (long or short)
             const sale = await allAsync('SELECT id FROM sales WHERE uuid = ?', [saleIdOrUuid]);
             if (sale && sale.length > 0) {
                 saleInternalId = sale[0].id;
             } else {
                 return { success: false, message: 'Venta no encontrada.' };
             }
        }

        const rows = await allAsync(
            `SELECT si.quantity, si.price_at_sale, p.name as product_name
             FROM sale_items si
             JOIN products p ON si.product_id = p.id
             WHERE si.sale_id = ?`,
            [saleInternalId]
        );
        return { success: true, items: rows };
    } catch (error) {
        console.error('Error getting sale items:', error);
        return { success: false, message: 'Database error.', error: error.message };
    }
}

async function getRecentSales(limit = 5) {
    try {
        const rows = await allAsync(
            'SELECT uuid as id, total_amount, sale_date FROM sales ORDER BY sale_date DESC LIMIT ?',
            [limit]
        );
        return { success: true, sales: rows };
    } catch (error) {
        console.error('Error getting recent sales:', error);
        return { success: false, message: 'Database error.' };
    }
}

async function getSalesByShiftId(shiftId) {
    try {
        // returning id as uuid if needed, though previously it wasn't returning id
        const rows = await allAsync(
            'SELECT uuid as id, total_amount, payment_method, sale_date FROM sales WHERE shift_id = ?',
            [shiftId]
        );
        return { success: true, sales: rows };
    } catch (error) {
        console.error('Error getting sales by shift:', error);
        return { success: false, message: 'Database error.', error: error.message };
    }
}

module.exports = {
    processSale,
    getSales,
    getSaleItems,
    getRecentSales,
    getSalesByShiftId,
};
