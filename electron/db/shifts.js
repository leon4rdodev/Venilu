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

async function createShift({ initialCash, userId }) {
    const startTime = new Date().toISOString();
    const status = 'open'; // Changed from 'OPEN' to 'open'

    try {
        const result = await runAsync(
            'INSERT INTO shifts (user_id, start_time, initial_cash, status) VALUES (?, ?, ?, ?)',
            [userId, startTime, initialCash, status]
        );
        const shiftId = result.lastID;

        // Fetch the newly created shift to return it directly
        const shift = await getAsync('SELECT * FROM shifts WHERE id = ?', [shiftId]);

        return { success: true, shift };
    } catch (error) {
        console.error('Error creating shift:', error.message);
        return { success: false, message: 'Failed to create shift.', error: error.message };
    }
}

async function getActiveShift(userId) {
    try {
        const shift = await getAsync(
            "SELECT * FROM shifts WHERE user_id = ? AND status = 'open' ORDER BY start_time DESC LIMIT 1",
            [userId]
        );
        return { success: true, shift };
    } catch (error) {
        console.error('Error getting active shift:', error.message);
        return { success: false, message: 'Failed to get active shift.', error: error.message };
    }
}

async function closeShift({ shiftId, finalCash }) {
    const endTime = new Date().toISOString();
    const status = 'closed'; // Changed from 'CLOSED' to 'closed'

    try {
        await runAsync('BEGIN TRANSACTION;');

        // Get shift details
        const shift = await getAsync('SELECT * FROM shifts WHERE id = ?', [shiftId]);

        if (!shift) {
            await runAsync('ROLLBACK;');
            return { success: false, message: 'Turno no encontrado.' };
        }

        // Calculate expected cash
        const sales = await allAsync(
            "SELECT SUM(total_amount) as total FROM sales WHERE shift_id = ? AND payment_method = 'cash'",
            [shiftId]
        );
        const cashSales = sales[0]?.total || 0;
        const expectedCash = shift.initial_cash + cashSales;
        const difference = finalCash - expectedCash;

        // Update shift
        await runAsync(
            'UPDATE shifts SET end_time = ?, final_cash = ?, expected_cash = ?, difference = ?, status = ? WHERE id = ?',
            [endTime, finalCash, expectedCash, difference, status, shiftId]
        );

        await runAsync('COMMIT;');
        return { success: true, message: 'Turno cerrado exitosamente.' };

    } catch (error) {
        try {
            await runAsync('ROLLBACK;');
        } catch (rollbackErr) {
            console.error('Error rolling back closeShift:', rollbackErr);
        }
        console.error('Error closing shift:', error.message);
        return { success: false, message: 'Error cerrando el turno.', error: error.message };
    }
}

async function getShiftsWithDetails(user) {
    try {
        // Validate user object
        if (!user || !user.id || !user.role) {
            console.error('Invalid user object:', user);
            return { success: false, message: 'Invalid user data.', shifts: [] };
        }

        let shiftsSql = `
            SELECT s.id, s.start_time, s.end_time, s.initial_cash, s.final_cash, s.expected_cash, s.difference, s.status, u.name as user_name
            FROM shifts s
            JOIN users u ON s.user_id = u.id
        `;
        const params = [];

        // Filter by user_id for non-admin roles (employee/vendedor)
        if (user.role !== 'admin') {
            shiftsSql += ' WHERE s.user_id = ?';
            params.push(user.id);
        }

        // Show all shifts (both open and closed), ordered by status (open first) and then by date
        shiftsSql += ' ORDER BY CASE WHEN s.status = \'open\' THEN 0 ELSE 1 END, s.start_time DESC LIMIT 100'; // Limit for performance

        const shifts = await allAsync(shiftsSql, params);

        if (!shifts || shifts.length === 0) {
            return { success: true, shifts: [] };
        }

        // Optimize: Fetch all relevant sales in one query instead of N+1
        const shiftIds = shifts.map(s => s.id);
        const placeholders = shiftIds.map(() => '?').join(',');
        
        const allSales = await allAsync(
            `SELECT s.uuid as id, s.shift_id, s.total_amount, s.payment_method, s.sale_date, s.amount_paid, s.change_given 
             FROM sales s
             WHERE s.shift_id IN (${placeholders}) 
             ORDER BY s.sale_date DESC`,
            shiftIds
        );

        // Group sales by shift_id
        const salesByShift = {};
        allSales.forEach(sale => {
            if (!salesByShift[sale.shift_id]) {
                salesByShift[sale.shift_id] = [];
            }
            salesByShift[sale.shift_id].push(sale);
        });

        // Attach sales to shifts
        const shiftsWithSales = shifts.map(shift => ({
            ...shift,
            sales: salesByShift[shift.id] || []
        }));

        return { success: true, shifts: shiftsWithSales };
    } catch (error) {
        console.error('Error getting shifts with details:', error.message, error.stack);
        return { success: false, message: 'Failed to get shifts.', error: error.message, shifts: [] };
    }
}

module.exports = {
    createShift,
    getActiveShift,
    closeShift,
    getShiftsWithDetails,
};
