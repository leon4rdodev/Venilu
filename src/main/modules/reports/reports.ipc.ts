import { ipcMain } from 'electron';
import { ReportsService } from '@main/modules/reports/services/reports.service';
import { PdfService } from '@main/shared/services/pdf.service';
import { requirePermission, getSessionUser } from '@main/shared/session';

const reportsService = new ReportsService();
const pdfService = new PdfService();

export function registerReportsHandlers() {
  // ─── Employee-level: shift summary (requires only pos:access) ─────────────

  /**
   * Returns the active shift stats for the current user.
   * Used by the adaptive dashboard — visible to any user with pos:access.
   * Does NOT expose business-wide financial data.
   */
  ipcMain.handle('get-shift-summary', async () => {
    try {
      requirePermission('pos:access');
      const session = getSessionUser()!;
      const summary = await reportsService.getShiftSummary(session.id);
      return { success: true, data: summary };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  // ─── Manager-level: dashboard overview (requires reports:view_summary) ────

  ipcMain.handle('get-dashboard-stats', async () => {
    try {
      requirePermission('reports:view_summary');
      return await reportsService.getDashboardStats();
    } catch (err: any) {
      console.error('[reports.ipc] get-dashboard-stats:', err);
      return {
        today: { totalSales: 0, totalTransactions: 0, averageTicket: 0, totalItemsSold: 0, averageMargin: 0, netProfit: 0 },
        yesterday: { totalSales: 0, totalTransactions: 0, averageTicket: 0, totalItemsSold: 0, averageMargin: 0, netProfit: 0 },
      };
    }
  });

  /** Hourly sales for the dashboard chart. Payload: { day?: 'today' | 'yesterday' } */
  ipcMain.handle('get-sales-by-hour', async (_event, payload) => {
    try {
      requirePermission('reports:view_summary');
      const offset = payload?.day === 'yesterday' ? -1 : 0;
      const data = await reportsService.getSalesByHour(offset as 0 | -1);
      return { success: true, data };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  /** Today's revenue split by payment method (dashboard widget). */
  ipcMain.handle('get-payment-method-totals', async () => {
    try {
      requirePermission('reports:view_summary');
      const data = await reportsService.getPaymentMethodTotals();
      return { success: true, data };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('get-top-selling-products', async (_event, { startDate, endDate, limit }) => {
    try {
      requirePermission('reports:view_summary');
      const products = await reportsService.getTopSellingProducts(
        startDate ? new Date(startDate) : null,
        endDate ? new Date(endDate) : null,
        limit,
      );
      return { success: true, data: products };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  // ─── Full reports page (requires reports:view_full) ───────────────────────

  ipcMain.handle('get-total-sales-metrics', async (_event, { startDate, endDate }) => {
    try {
      requirePermission('reports:view_full');
      return await reportsService.getTotalSalesMetrics(
        startDate ? new Date(startDate) : null,
        endDate ? new Date(endDate) : null,
      );
    } catch (err: any) {
      console.error('[reports.ipc] get-total-sales-metrics:', err);
      const empty = { totalAmount: 0, netProfit: 0, totalCost: 0, averageMargin: 0, totalSalesCount: 0, totalItemsSold: 0, averageTicket: 0 };
      return { current: empty, previous: empty };
    }
  });

  ipcMain.handle('get-sales-over-time', async (_event, { startDate, endDate, interval }) => {
    try {
      requirePermission('reports:view_full');
      return reportsService.getSalesOverTime(
        startDate ? new Date(startDate) : null,
        endDate ? new Date(endDate) : null,
        interval,
      );
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('get-least-selling-products', async (_event, { startDate, endDate, limit }) => {
    try {
      requirePermission('reports:view_full');
      return {
        success: true,
        data: await reportsService.getLeastSellingProducts(
          startDate ? new Date(startDate) : null,
          endDate ? new Date(endDate) : null,
          limit,
        ),
      };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('generate-sales-report-pdf', async (_event, data) => {
    try {
      requirePermission('reports:export_pdf');
      return await pdfService.generateSalesReportPdf(data);
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });
}
