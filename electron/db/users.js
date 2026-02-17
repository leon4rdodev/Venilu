const bcrypt = require('bcryptjs');
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

async function verifyUser(username, password) {
    try {
        const row = await getAsync(
            'SELECT id, password, role, name, username FROM users WHERE username = ?',
            [username]
        );

        if (!row) {
            return { success: false, message: 'Invalid username or password.' };
        }

        const match = await bcrypt.compare(password, row.password);
        
        if (match) {
            return {
                success: true,
                id: row.id,
                role: row.role,
                name: row.name,
                username: row.username
            };
        } else {
            return { success: false, message: 'Invalid username or password.' };
        }
    } catch (error) {
        console.error('Error verifying user:', error);
        return { success: false, message: 'Database error.' };
    }
}

async function getUsers() {
    try {
        const rows = await allAsync('SELECT id, username, name, role FROM users', []);
        return { success: true, users: rows };
    } catch (error) {
        console.error('Error getting users:', error);
        return { success: false, message: 'Database error.' };
    }
}

async function createUser(userData) {
    try {
        const { username, name, password, role } = userData;
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const result = await runAsync(
            'INSERT INTO users (username, name, password, role) VALUES (?, ?, ?, ?)',
            [username, name, hashedPassword, role]
        );
        
        return {
            success: true,
            user: { id: result.lastID, username, name, role }
        };
    } catch (error) {
        console.error('Error creating user:', error);
        return { success: false, message: 'Username already exists.' };
    }
}

async function updateUser(userId, userData) {
    try {
        const { username, name, password, role } = userData;
        let query = 'UPDATE users SET username = ?, name = ?, role = ?';
        const params = [username, name, role];

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            query += ', password = ?';
            params.push(hashedPassword);
        }

        query += ' WHERE id = ?';
        params.push(userId);

        await runAsync(query, params);
        return { success: true };
    } catch (error) {
        console.error('Error updating user:', error);
        return { success: false, message: 'Error updating user.' };
    }
}

async function deleteUser(userId) {
    try {
        await runAsync('DELETE FROM users WHERE id = ?', [userId]);
        return { success: true };
    } catch (error) {
        console.error('Error deleting user:', error);
        return { success: false, message: 'Error deleting user.' };
    }
}

module.exports = {
    verifyUser,
    getUsers,
    createUser,
    updateUser,
    deleteUser,
};