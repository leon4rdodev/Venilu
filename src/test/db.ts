/**
 * Test database helpers for backend (main-process) tests.
 *
 * With `electron` aliased to src/test/mocks/electron.ts, AppDataSource points
 * at a fresh temp directory per vitest worker, so each test FILE gets its own
 * isolated SQLite database (synchronize:true builds the schema on init).
 */
import { AppDataSource } from '@main/config/data-source';
import { User } from '@main/modules/users/entities/user.entity';
import { Role } from '@main/modules/users/entities/role.entity';
import { Category } from '@main/modules/categories/entities/category.entity';
import { Product } from '@main/modules/products/entities/product.entity';
import { Customer } from '@main/modules/customers/entities/customer.entity';
import { Shift } from '@main/modules/shifts/entities/shift.entity';
import { Sale } from '@main/modules/sales/entities/sale.entity';
import { SaleItem } from '@main/modules/sales/entities/sale-item.entity';
import { DebtPayment } from '@main/modules/sales/entities/debt-payment.entity';
import bcrypt from 'bcryptjs';

export async function initTestDb() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    // synchronize is off — the schema comes from migrations, so every test run
    // also validates that the migration chain builds a working database.
    await AppDataSource.runMigrations();
  }
  return AppDataSource;
}

export async function closeTestDb() {
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
}

/** Wipes all rows between tests without rebuilding the schema. */
export async function resetTestDb() {
  // Children before parents so FK constraints (PRAGMA foreign_keys=ON) hold:
  // audit → sale_items/debt_payments → sales → expenses → shifts → products →
  // customers → categories → settings → users → roles.
  const tableOrder = [
    'audit_logs',
    'sale_return_items',
    'sale_returns',
    'sale_items',
    'debt_payments',
    'sales',
    'purchase_items',
    'supplier_payments',
    'purchases',
    'stock_movements',
    'shift_capital',
    'shift_expenses',
    'shifts',
    'product_barcodes',
    'products',
    'suppliers',
    'customers',
    'categories',
    'settings',
    'users',
    'roles',
  ];
  const metas = AppDataSource.entityMetadatas;
  const byTable = new Map(metas.map(m => [m.tableName, m]));
  for (const table of tableOrder) {
    const meta = byTable.get(table);
    if (!meta) continue;
    await AppDataSource.getRepository(meta.name).createQueryBuilder().delete().execute();
  }
  // Any entity not covered by the explicit list (future additions)
  for (const meta of metas) {
    if (!tableOrder.includes(meta.tableName)) {
      await AppDataSource.getRepository(meta.name).createQueryBuilder().delete().execute();
    }
  }
}

// ─── Factories ────────────────────────────────────────────────────────────────

let seq = 0;
const next = () => ++seq;

export async function createTestRole(overrides: Partial<Role> = {}): Promise<Role> {
  const repo = AppDataSource.getRepository(Role);
  return repo.save(repo.create({
    name: `role-${next()}`,
    permissions: ['pos:access'],
    is_system: false,
    ...overrides,
  } as Partial<Role>));
}

export async function createTestUser(overrides: Partial<User> = {}): Promise<User> {
  const repo = AppDataSource.getRepository(User);
  return repo.save(repo.create({
    username: `user${next()}`,
    name: `Test User ${seq}`,
    password: bcrypt.hashSync('secret123', 4),
    role: 'admin',
    ...overrides,
  } as Partial<User>));
}

export async function createTestCategory(overrides: Partial<Category> = {}): Promise<Category> {
  const repo = AppDataSource.getRepository(Category);
  return repo.save(repo.create({ name: `Categoría ${next()}`, ...overrides } as Partial<Category>));
}

export async function createTestProduct(overrides: Partial<Product> = {}): Promise<Product> {
  const repo = AppDataSource.getRepository(Product);
  return repo.save(repo.create({
    name: `Producto ${next()}`,
    sale_price: 100,
    cost_price: 60,
    stock: 50,
    min_stock: 5,
    ...overrides,
  } as Partial<Product>));
}

export async function createTestCustomer(overrides: Partial<Customer> = {}): Promise<Customer> {
  const repo = AppDataSource.getRepository(Customer);
  return repo.save(repo.create({
    name: `Cliente ${next()}`,
    balance: 0,
    ...overrides,
  } as Partial<Customer>));
}

export async function createTestShift(userId: string, overrides: Partial<Shift> = {}): Promise<Shift> {
  const repo = AppDataSource.getRepository(Shift);
  return repo.save(repo.create({
    // Zero-padded so SHIFT001/SHIFT010/SHIFT100 never collide (padEnd did).
    id: `SHIFT${String(next()).padStart(3, '0')}`,
    user_id: userId,
    initial_cash: 1000,
    start_time: new Date(),
    status: 'open',
    ...overrides,
  } as Partial<Shift>));
}

export interface TestSaleItemInput {
  product_id: string;
  quantity: number;
  unit_price: number;
  product_name?: string;
}

/**
 * Persists a Sale (optionally with items) directly, bypassing SalesService —
 * for report/listing tests that need full control (voided status, custom dates).
 */
export async function createTestSale(opts: {
  user_id: string;
  shift_id?: string;
  customer_id?: string;
  customer_name?: string;
  payment_method?: Sale['payment_method'];
  status?: Sale['status'];
  total_amount: number;
  subtotal?: number;
  discount_amount?: number;
  amount_paid?: number;
  created_at?: Date;
  items?: TestSaleItemInput[];
}): Promise<Sale> {
  const repo = AppDataSource.getRepository(Sale);
  const sale = repo.create({
    id: `SALE${String(next()).padStart(4, '0')}`,
    user_id: opts.user_id,
    shift_id: opts.shift_id,
    customer_id: opts.customer_id,
    customer_name: opts.customer_name,
    payment_method: opts.payment_method ?? 'cash',
    status: opts.status ?? 'paid',
    subtotal: opts.subtotal ?? opts.total_amount,
    discount_amount: opts.discount_amount ?? 0,
    total_amount: opts.total_amount,
    amount_paid: opts.amount_paid ?? (opts.status === 'credit' ? 0 : opts.total_amount),
    change_given: 0,
    ...(opts.created_at ? { created_at: opts.created_at } : {}),
  } as Partial<Sale>);
  sale.items = (opts.items ?? []).map(i => {
    const item = new SaleItem();
    item.product_id = i.product_id;
    item.product_name = i.product_name ?? 'Item';
    item.quantity = i.quantity;
    item.unit_price = i.unit_price;
    item.total_price = Math.round(i.quantity * i.unit_price * 100) / 100;
    return item;
  });
  return repo.save(sale);
}

export async function createTestDebtPayment(opts: {
  customer_id: string;
  amount: number;
  shift_id?: string;
  payment_method?: 'cash' | 'transfer';
}): Promise<DebtPayment> {
  const repo = AppDataSource.getRepository(DebtPayment);
  return repo.save(repo.create({
    customer_id: opts.customer_id,
    shift_id: opts.shift_id,
    amount: opts.amount,
    payment_method: opts.payment_method ?? 'cash',
  } as Partial<DebtPayment>));
}
