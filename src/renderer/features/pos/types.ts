/**
 * POS feature-level types.
 *
 * These types are shared across multiple components and hooks within the POS
 * feature but are not domain-level entities — they describe API response shapes
 * and UI-specific data structures.
 *
 * Domain entities (Shift, Sale, DebtPayment…) live in @shared/types/models.
 */

import type { Sale, DebtPaymentSummary, SaleReturnSummary } from '@shared/types/models';

// ---------------------------------------------------------------------------
// Shift context
// ---------------------------------------------------------------------------

/**
 * Minimal sale shape stored in the shift context — avoids keeping full Sale
 * objects (with items, relations, etc.) in memory during an active session.
 */
export type ShiftSale = Pick<Sale, 'total_amount' | 'payment_method' | 'status'>;

// ---------------------------------------------------------------------------
// Shift history (returned by `history:get`)
// ---------------------------------------------------------------------------

/**
 * A shift entry as returned by the `history:get` IPC handler.
 * Extends the base Shift type with fields that are only available from the
 * history query (user_name, resolved sales array, debt_payments).
 */
export interface ShiftHistoryEntry {
  id: string;
  user_id: string;
  user_name: string;
  start_time: string;
  end_time: string | null;
  initial_cash: number;
  final_cash: number | null;
  expected_cash: number | null;
  difference: number | null;
  status: 'open' | 'closed';
  force_closed?: boolean;
  force_closed_by?: string;
  force_close_reason?: string;
  /** Sales that occurred during this shift */
  sales: Array<Sale & { sale_date: string }>;
  /** Debt payments received during this shift */
  debt_payments: DebtPaymentSummary[];
  /** Cash expenses recorded during this shift */
  expenses?: any[];
  /** Partial returns refunded in cash from this shift's register */
  returns?: SaleReturnSummary[];
}

// ---------------------------------------------------------------------------
// Pagination (used by POS product fetching)
// ---------------------------------------------------------------------------

export interface POSPagination {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
