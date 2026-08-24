/**
 * Customers feature-level types — shapes returned by the mature customer
 * endpoints (`list-customers`, `get-customer-summary`).
 */

import type { Customer } from '@shared/types/models';

export type CustomerFilter = 'all' | 'debtors' | 'credit' | 'inactive';
export type CustomerSortBy =
  | 'name'
  | 'balance'
  | 'created_at'
  | 'total_spent'
  | 'purchases_count'
  | 'last_purchase_at';

/** Customer row with SQL-computed purchase aggregates (voided sales excluded). */
export interface CustomerListItem extends Customer {
  purchases_count: number;
  total_spent: number;
  last_purchase_at: string | null;
}

export interface CustomerListResponse {
  success: boolean;
  message?: string;
  data?: {
    items: CustomerListItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

/** Aggregated profile summary for the customer detail view. */
export interface CustomerSummary {
  purchasesCount: number;
  totalSpent: number;
  averageTicket: number;
  lastPurchaseAt: string | null;
  firstPurchaseAt: string | null;
  totalPaidDebt: number;
  paymentsCount: number;
  balance: number;
  creditLimit: number | null;
  creditAvailable: number | null;
}

export interface CustomerSummaryResponse {
  success: boolean;
  message?: string;
  data?: CustomerSummary;
}
