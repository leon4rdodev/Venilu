export type UserRole = "admin" | "employee";
export type PaymentMethod = "cash" | "card" | "transfer" | "credit";
export type SaleStatus = "paid" | "credit" | "partial" | "voided";
export type ShiftStatus = "open" | "closed";
export type DebtPaymentMethod = "cash" | "transfer";

// ---------------------------------------------------------------------------
// Domain entities
// ---------------------------------------------------------------------------

/**
 * A configurable role with a set of granular permissions.
 * System roles (is_system: true) cannot be edited or deleted.
 */
export interface Role {
  id: string;
  name: string;
  is_system: boolean;
  permissions: string[];
  created_at: string | Date;
  updated_at: string | Date;
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  /** FK to the assigned Role entity */
  role_id?: string;
  /** Eagerly loaded Role object from DB (optional in some payloads) */
  role_entity?: Role;
  /** Flattened permission strings from the assigned Role — loaded from DB on login */
  permissions: string[];
  created_at: string | Date;
  updated_at: string | Date;
}

export interface Category {
  id: string;
  name: string;
  created_at: string | Date;
  updated_at: string | Date;
  product_count?: number;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  balance: number;
  /** Max credit allowed. null = unlimited. */
  credit_limit?: number | null;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  sale_price: number;
  cost_price: number;
  stock: number;
  category_id?: string;
  category?: Category | null;
  barcode?: string;
  sku?: string;
  min_stock?: number;
  /**
   * Product photo. Stored as a managed file name (e.g. "prod_ab12.webp") served
   * via venilu://product-images/. Legacy rows may still hold a data URL.
   */
  image?: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  has_sales?: boolean;
}

export interface Sale {
  id: string;
  user_id: string;
  user?: User;
  shift_id: string;
  customer_id?: string;
  customer?: Customer;
  customer_name?: string;
  sale_date: string | Date;
  subtotal?: number;
  discount_amount?: number;
  total_amount: number;
  amount_paid?: number;
  change_given?: number;
  payment_method: PaymentMethod;
  status: SaleStatus;
  items?: SaleItem[];
  created_at: string | Date;
  updated_at: string | Date;
}

export interface SaleItem {
  id?: string;
  sale_id?: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  /** Legacy alias used by some frontend mappers */
  price_at_sale?: number;
}

/**
 * A cash/transfer payment received from a customer to reduce their credit balance.
 * Always linked to a Shift so it appears in cash reconciliation.
 */
export interface DebtPayment {
  id: string;
  customer_id: string;
  customer?: Customer;
  /** Display name — populated when fetching with relations */
  customer_name?: string;
  shift_id?: string;
  amount: number;
  payment_method: DebtPaymentMethod;
  notes?: string;
  created_at: string | Date;
}

/**
 * Lightweight summary of a debt payment as returned by the shift history API.
 * Includes the customer name resolved server-side.
 */
export interface DebtPaymentSummary {
  id: string;
  customer_id: string;
  customer_name: string;
  shift_id?: string;
  amount: number;
  payment_method: DebtPaymentMethod;
  notes?: string;
  created_at: string | Date;
}

export interface Shift {
  id: string;
  user_id: string;
  /** Resolved from the user relation — available in history responses */
  user_name?: string;
  start_time: string | Date;
  end_time?: string | Date;
  initial_cash: number;
  final_cash?: number;
  expected_cash?: number;
  difference?: number;
  status: ShiftStatus;
  sales?: Sale[];
  /** Debt payments received during this shift — populated by getShiftsHistory */
  debt_payments?: DebtPaymentSummary[];
  force_closed?: boolean;
  force_closed_by?: string;
  force_close_reason?: string;
}

export interface Setting {
  id: number;
  business_name: string;
  business_address: string;
  business_phone: string;
  business_email: string;
  business_tax_id: string;
  logo_filename: string | null;
  printer_name: string | null;
  paper_size: string;
  currency: string;
  /** Custom message printed at the bottom of every receipt (multi-line). */
  receipt_footer?: string | null;
  /** Print the receipt automatically right after each completed sale. */
  auto_print_receipt?: boolean;
  /** Automatic backup cadence: 'off' | 'daily' | 'weekly'. */
  auto_backup?: string;
  /** How many automatic backups to keep before pruning the oldest. */
  auto_backup_retention?: number;
}

/** One kardex row (Inventario → Movimientos de stock). */
export interface StockMovementEntry {
  id: string;
  product_id: string;
  type: 'sale' | 'void' | 'adjustment' | 'initial';
  quantity_delta: number;
  stock_after: number;
  reference?: string | null;
  user_id?: string | null;
  username?: string | null;
  note?: string | null;
  created_at: string;
}

/** One row of the audit trail (Ajustes → Actividad). */
export interface AuditLogEntry {
  id: string;
  user_id: string;
  username: string;
  action: string;
  target_id?: string | null;
  target_label?: string | null;
  metadata?: string | null;
  created_at: string;
}
