/**
 * Dashboard feature-level types.
 *
 * Shared across `use-dashboard.ts` and all dashboard widget components.
 * Keeping them here avoids re-declaring the same interfaces in each file.
 */

import type { IPCResponse } from '@shared/types/ipc';
import type { Product, Sale } from '@shared/types/models';

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export interface DayStats {
  totalSales: number;
  totalTransactions: number;
  averageTicket: number;
  totalItemsSold: number;
  averageMargin: number;
  netProfit: number;
}

export interface HourlySalesPoint {
  hour: number;
  total: number;
  transactions: number;
}

export interface PaymentMethodTotal {
  method: string;
  total: number;
  transactions: number;
}

export interface InventoryStatsData {
  totalProducts: number;
  totalStockUnits: number;
  totalStockValue: number;
  outOfStockProducts: number;
  lowStockProducts: number;
}

export interface DashboardStatsResponse {
  today: DayStats;
  yesterday: DayStats;
}

// ---------------------------------------------------------------------------
// Top products
// ---------------------------------------------------------------------------

export interface TopProduct {
  productName: string;
  totalSold: number;
}

export interface TopProductsResponse {
  success: boolean;
  data?: TopProduct[];
}

// ---------------------------------------------------------------------------
// Shift summary (quick widget on dashboard)
// ---------------------------------------------------------------------------

export interface ShiftSummary {
  hasOpenShift: boolean;
  shiftId?: string;
  startTime?: string;
  totalTransactions: number;
  totalAmount: number;
}

// ---------------------------------------------------------------------------
// IPC response aliases (avoids repeating `extends IPCResponse` everywhere)
// ---------------------------------------------------------------------------

export interface LowStockResponse extends IPCResponse { data?: Product[] }
export interface RecentSalesResponse extends IPCResponse { data?: Sale[] }
export interface ShiftSummaryResponse extends IPCResponse { data?: ShiftSummary }
export interface HourlySalesResponse extends IPCResponse { data?: HourlySalesPoint[] }
export interface PaymentMethodsResponse extends IPCResponse { data?: PaymentMethodTotal[] }
export interface InventoryStatsResponse extends IPCResponse { data?: InventoryStatsData }
