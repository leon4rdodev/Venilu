const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

let db;

// === Helper functions to promisify sqlite3 methods ===

function dbRunAsync(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this); // 'this' contains lastID, changes
        });
    });
}

function dbGetAsync(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAllAsync(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// === Table creation functions ===

async function createUsersTable(db) {
    const sql = `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL
    )`;
    await dbRunAsync(db, sql);
    console.log('Users table created or already exists.');
}

async function createProductsTable(db) {
    const sql = `CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        category_id INTEGER NOT NULL,
        purchase_price REAL NOT NULL,
        sale_price REAL NOT NULL,
        stock INTEGER NOT NULL,
        sku TEXT,
        min_stock INTEGER DEFAULT 5,
        FOREIGN KEY (category_id) REFERENCES categories(id)
    )`;
    await dbRunAsync(db, sql);
    console.log('Products table created or already exists.');
    
    // Create index on category_id for better query performance
    await dbRunAsync(db, 'CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id)');
    console.log('Products category_id index created or already exists.');

    // Migration: Check if sku and min_stock columns exist, if not add them
    try {
        const tableInfo = await dbAllAsync(db, "PRAGMA table_info(products)");
        const columnNames = tableInfo.map(c => c.name);

        if (!columnNames.includes('sku')) {
            console.log('Adding sku column to products table...');
            await dbRunAsync(db, 'ALTER TABLE products ADD COLUMN sku TEXT');
        }

        if (!columnNames.includes('min_stock')) {
            console.log('Adding min_stock column to products table...');
            await dbRunAsync(db, 'ALTER TABLE products ADD COLUMN min_stock INTEGER DEFAULT 5');
        }
    } catch (error) {
        console.error('Error checking/migrating products table columns:', error);
    }
}

async function createSalesTable(db) {
    const sql = `CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT UNIQUE,
        user_id INTEGER NOT NULL,
        shift_id INTEGER NOT NULL,
        total_amount REAL NOT NULL,
        payment_method TEXT NOT NULL,
        amount_paid REAL NOT NULL,
        change_given REAL NOT NULL,
        sale_date TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (shift_id) REFERENCES shifts(id)
    )`;
    await dbRunAsync(db, sql);
    console.log('Sales table created or already exists.');

    // Migration: Check if uuid column exists
    try {
        const tableInfo = await dbAllAsync(db, "PRAGMA table_info(sales)");
        const columnNames = tableInfo.map(c => c.name);

        if (!columnNames.includes('uuid')) {
            console.log('Adding uuid column to sales table...');
            await dbRunAsync(db, 'ALTER TABLE sales ADD COLUMN uuid TEXT');
            await dbRunAsync(db, 'CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_uuid ON sales(uuid)');
            
            // Backfill existing rows
            const rows = await dbAllAsync(db, 'SELECT id FROM sales WHERE uuid IS NULL');
            if (rows.length > 0) {
                console.log(`Backfilling UUIDs for ${rows.length} sales...`);
                const { randomUUID } = require('crypto');
                
                await dbRunAsync(db, 'BEGIN TRANSACTION');
                try {
                    for (const row of rows) {
                        const uuid = randomUUID();
                        await dbRunAsync(db, 'UPDATE sales SET uuid = ? WHERE id = ?', [uuid, row.id]);
                    }
                    await dbRunAsync(db, 'COMMIT');
                    console.log('UUID backfill completed.');
                } catch (err) {
                    await dbRunAsync(db, 'ROLLBACK');
                    console.error('Error backfilling UUIDs:', err);
                }
            }
        }
    } catch (error) {
        console.error('Error checking/migrating sales table columns:', error);
    }
}

async function createSaleItemsTable(db) {
    const sql = `CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        price_at_sale REAL NOT NULL,
        FOREIGN KEY (sale_id) REFERENCES sales(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
    )`;
    await dbRunAsync(db, sql);
    console.log('Sale_items table created or already exists.');
}

async function createShiftsTable(db) {
    const sql = `CREATE TABLE IF NOT EXISTS shifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        initial_cash REAL NOT NULL,
        final_cash REAL,
        expected_cash REAL,
        difference REAL,
        status TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`;
    await dbRunAsync(db, sql);
    console.log('Shifts table created or already exists.');
}

async function createSettingsTable(db) {
    const sql = `CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        business_name TEXT,
        business_address TEXT,
        business_phone TEXT,
        business_email TEXT,
        business_tax_id TEXT,
        logo_filename TEXT,
        printer_name TEXT,
        paper_size TEXT DEFAULT '80mm'
    )`;
    await dbRunAsync(db, sql);
    console.log('Settings table created or already exists.');
}

async function createCategoriesTable(db) {
    const sql = `CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        created_at TEXT NOT NULL
    )`;
    await dbRunAsync(db, sql);
    console.log('Categories table created or already exists.');
}

// === Data initialization functions ===

async function insertDefaultSettings(db) {
    const existingSettings = await dbGetAsync(db, 'SELECT id FROM settings WHERE id = 1');

    if (!existingSettings) {
        const sql = `INSERT INTO settings (id, business_name, business_address, business_phone, business_email, business_tax_id, paper_size)
                     VALUES (1, 'Mi Negocio', '', '', '', '', '80mm')`;
        await dbRunAsync(db, sql);
        console.log('Default settings inserted.');
    }
}

async function insertDefaultCategories(db) {
    const result = await dbGetAsync(db, 'SELECT COUNT(*) as count FROM categories');

    if (result.count === 0) {
        const defaultCategories = ['Celulares', 'Accesorios', 'Cargadores y Cables', 'Protectores y Fundas', 'Audífonos', 'Repuestos', 'Otros'];
        const timestamp = new Date().toISOString();

        for (const category of defaultCategories) {
            await dbRunAsync(db, 'INSERT INTO categories (name, created_at) VALUES (?, ?)', [category, timestamp]);
        }

        console.log('Default categories inserted.');
    }
}

// Default users removed - will be created during onboarding

// === Main initialization function ===

// Helper to generate short ID
function generateShortId() {
    return require('crypto').randomBytes(4).toString('hex').toUpperCase();
}

async function initializeDatabase(userDataPath) {
    return new Promise((resolve, reject) => {
        // Ensure data directory exists
        if (!fs.existsSync(userDataPath)) {
            fs.mkdirSync(userDataPath, { recursive: true });
        }

        const DB_PATH = path.join(userDataPath, 'database.sqlite');

        // Open database connection
        db = new sqlite3.Database(DB_PATH, async (err) => {
            if (err) {
                console.error('Error opening database:', err.message);
                return reject(err);
            }

            console.log('Connected to the SQLite database at:', DB_PATH);

            // Enable Foreign Keys and WAL mode
            db.serialize(() => {
                db.run('PRAGMA foreign_keys = ON;', (err) => {
                    if (err) console.error('Error enabling foreign keys:', err);
                    else console.log('Foreign keys enabled.');
                });
                db.run('PRAGMA journal_mode = WAL;', (err) => {
                    if (err) console.error('Error enabling WAL mode:', err);
                    else console.log('WAL mode enabled.');
                });
            });

            try {
                // Create all tables sequentially
                await createUsersTable(db);
                await createProductsTable(db);
                await createSalesTable(db);
                await createSaleItemsTable(db);
                await createShiftsTable(db);
                await createSettingsTable(db);
                await createCategoriesTable(db);

                // Run data migrations
                // await shortenExistingUUIDs(db); // Disabled by user request

                // Insert default data
                await insertDefaultSettings(db);
                await insertDefaultCategories(db);
                // Users will be created during onboarding

                resolve();
            } catch (error) {
                console.error('Error during database initialization:', error);
                reject(error);
            }
        });
    });
}

// === Public API functions ===

function getDb() {
    if (!db) {
        throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    return db;
}

/**
 * Close the database connection gracefully.
 * Used before restore operations to release the file lock.
 */
function closeDatabase() {
    return new Promise((resolve, reject) => {
        if (!db) {
            return resolve();
        }
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err);
                return reject(err);
            }
            console.log('Database connection closed.');
            db = null;
            resolve();
        });
    });
}

function runAsync(sql, params = []) {
    const database = getDb();
    return dbRunAsync(database, sql, params);
}

function allAsync(sql, params = []) {
    const database = getDb();
    return dbAllAsync(database, sql, params);
}

module.exports = {
    initializeDatabase,
    closeDatabase,
    getDb,
    runAsync,
    allAsync,
};