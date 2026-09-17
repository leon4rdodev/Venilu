import type { Supplier, Purchase, SupplierPayment } from "@shared/types/models";

export type SupplierFilter = "all" | "debtors" | "inactive";
export type SupplierSortBy = "name" | "balance" | "created_at" | "total_purchased" | "purchases_count" | "last_purchase_at";

export interface SupplierListItem extends Supplier {
  purchases_count: number;
  total_purchased: number;
  last_purchase_at: string | null;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface IpcResult<T> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface SupplierStats {
  totalSuppliers: number;
  activeSuppliers: number;
  suppliersWithDebt: number;
  totalPayable: number;
  purchasesThisMonth: number;
  purchasedThisMonth: number;
  overduePurchases: number;
  overdueAmount: number;
  paidThisMonth: number;
}

export interface SupplierSummary {
  purchasesCount: number;
  totalPurchased: number;
  averagePurchase: number;
  lastPurchaseAt: string | null;
  firstPurchaseAt: string | null;
  paymentsCount: number;
  totalPaid: number;
  balance: number;
  overdueAmount: number;
  creditDays: number;
}

export type PurchaseListResult = Paged<Purchase>;
export type SupplierPaymentsResult = { success: boolean; data?: SupplierPayment[]; total?: number; totalPages?: number; message?: string };
