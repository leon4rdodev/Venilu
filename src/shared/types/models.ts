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
  /** true = exento de ITBIS (default: gravado). */
  itbis_exempt?: boolean;
  /** Presentación: id del producto padre (null/ausente = producto principal). */
  parent_product_id?: string | null;
  /** Etiqueta de la presentación, p. ej. "Pequeño 250ml". */
  variant_name?: string | null;
  /** Producto padre (cargado en algunas respuestas). */
  parent?: Product | null;
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
  /** Comprobante fiscal (RD) — presentes solo si se emitió NCF. */
  ncf?: string | null;
  ncf_type?: 'B01' | 'B02' | null;
  fiscal_customer_rnc?: string | null;
  fiscal_customer_name?: string | null;
  itbis_amount?: number | null;
  /** Nota de Crédito B04 emitida al anular esta venta. */
  credit_note_ncf?: string | null;
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
  /** 'payment' = abono recibido; 'refund' = dinero devuelto al anular una venta fiada ya cobrada. */
  type?: 'payment' | 'refund';
  /** Id de la venta asociada (reembolsos). */
  reference?: string;
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
  type?: 'payment' | 'refund';
  reference?: string;
  notes?: string;
  created_at: string | Date;
}

/** Devolución parcial (resumen) — reembolsada en efectivo desde la caja del turno. */
export interface SaleReturnSummary {
  id: string;
  sale_id: string;
  shift_id?: string;
  user_id?: string;
  username?: string;
  total_refunded: number;
  itbis_refunded?: number;
  cost_refunded?: number;
  credit_note_ncf?: string;
  /** Fecha de anulación (null si no está anulada). */
  voided_at?: string | Date | null;
  note?: string;
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
  /** Devoluciones parciales cargadas a este turno — populated by getShiftsHistory */
  returns?: SaleReturnSummary[];
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
  /** Facturación con comprobantes fiscales (NCF) activada. */
  fiscal_enabled?: boolean;
  /** Tasa de ITBIS vigente (%). */
  itbis_rate?: number;
  /** Trial anchor (ISO) — set once at first boot; not client-editable. */
  trial_started_at?: string | null;
}

/** Licensing status served by license:status (see main/shared/services/license.service). */
export interface LicenseInfo {
  id: string;
  customer: string;
  business?: string;
  type: 'perpetua' | 'anual';
  issued: string;
  expires?: string;
}

export interface LicenseStatus {
  state: 'trial' | 'active' | 'expired' | 'trial_expired';
  blocked: boolean;
  license?: LicenseInfo;
  trialDaysLeft?: number;
  daysToExpiry?: number;
}

/** One kardex row (Inventario → Movimientos de stock). */
export interface StockMovementEntry {
  id: string;
  product_id: string;
  type: 'sale' | 'void' | 'adjustment' | 'initial' | 'return' | 'purchase' | 'purchase_void';
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

// ─── Suplidores y compras ─────────────────────────────────────────────────────

export interface Supplier {
  id: string;
  name: string;
  rnc?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  /** Días de crédito que otorga el suplidor (0 = de contado). */
  credit_days: number;
  /** Cuenta por pagar acumulada (lo que el negocio le debe). */
  balance: number;
  active: boolean;
  created_at: string | Date;
  updated_at?: string | Date;
}

export type PurchaseStatus = 'received' | 'cancelled';
export type PurchasePaymentStatus = 'paid' | 'partial' | 'pending';

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  previous_cost?: number | null;
}

export interface Purchase {
  id: string;
  supplier_id: string;
  supplier_name: string;
  invoice_number?: string | null;
  status: PurchaseStatus;
  payment_status: PurchasePaymentStatus;
  total_amount: number;
  amount_paid: number;
  due_date?: string | Date | null;
  notes?: string | null;
  user_id?: string | null;
  username?: string | null;
  updated_costs: boolean;
  items?: PurchaseItem[];
  supplier?: Supplier;
  created_at: string | Date;
  cancelled_at?: string | Date | null;
}

export interface SupplierPayment {
  id: string;
  supplier_id: string;
  purchase_id?: string | null;
  amount: number;
  payment_method: 'cash' | 'transfer';
  shift_id?: string | null;
  notes?: string | null;
  username?: string | null;
  created_at: string | Date;
}
