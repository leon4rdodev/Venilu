export type UserRole = "admin" | "employee";
export type PaymentMethod = "cash" | "card" | "transfer" | "credit";
export type SaleStatus = "paid" | "credit" | "partial";
export type ShiftStatus = "open" | "closed";

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
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
  price_at_sale?: number; // legacy/frontend mapping
}

export interface Shift {
  id: string;
  user_id: string;
  start_time: string | Date;
  end_time?: string | Date;
  initial_cash: number;
  final_cash?: number;
  expected_cash?: number;
  difference?: number;
  status: ShiftStatus;
  sales?: Sale[];
  force_closed?: boolean;
  force_closed_by?: string;
  force_close_reason?: string;
}

export interface DebtPayment {
  id: string;
  customer_id: string;
  customer?: Customer;
  shift_id?: string;
  amount: number;
  payment_method: 'cash' | 'transfer';
  notes?: string;
  created_at: string | Date;
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
}

