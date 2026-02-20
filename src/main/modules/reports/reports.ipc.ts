import { ipcMain } from "electron";
import { ReportsService } from "@main/modules/reports/services/reports.service";
import { PdfService } from "@main/shared/services/pdf.service";
import { requireRole } from "@main/shared/session";

const reportsService = new ReportsService();
const pdfService = new PdfService();

export function registerReportsHandlers() {
    // All report handlers are admin-only
    ipcMain.handle('get-total-sales-metrics', async (_event, { startDate, endDate }) => {
        try {
            requireRole('admin');
            const metrics = await reportsService.getTotalSalesMetrics(
                startDate ? new Date(startDate) : null,
                endDate ? new Date(endDate) : null
            );
            return metrics;
        } catch (error: any) {
            console.error("Error in get-total-sales-metrics IPC:", error);
            const emptyMetrics = {
                totalAmount: 0, netProfit: 0, totalCost: 0, averageMargin: 0,
                totalSalesCount: 0, totalItemsSold: 0, averageTicket: 0
            };
            return { current: emptyMetrics, previous: emptyMetrics };
        }
    });

    ipcMain.handle('get-top-selling-products', async (_event, { startDate, endDate, limit }) => {
        try {
            requireRole('admin');
            const products = await reportsService.getTopSellingProducts(
                startDate ? new Date(startDate) : null,
                endDate ? new Date(endDate) : null,
                limit
            );
            return { success: true, products };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('get-sales-over-time', async (_event, { startDate, endDate, interval }) => {
        try {
            requireRole('admin');
            return reportsService.getSalesOverTime(
                startDate ? new Date(startDate) : null,
                endDate ? new Date(endDate) : null,
                interval
            );
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('get-least-selling-products', async (_event, { startDate, endDate, limit }) => {
        try {
            requireRole('admin');
            return { success: true, products: await reportsService.getLeastSellingProducts(
                startDate ? new Date(startDate) : null,
                endDate ? new Date(endDate) : null,
                limit
            )};
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    // Dashboard stats: admin only (shows financial overview)
    ipcMain.handle('get-dashboard-stats', async () => {
        try {
            requireRole('admin');
            return await reportsService.getDashboardStats();
        } catch (error: any) {
            console.error("Error in get-dashboard-stats IPC:", error);
            return {
                today: { totalSales: 0, totalTransactions: 0, averageTicket: 0, totalItemsSold: 0 },
                yesterday: { totalSales: 0, totalTransactions: 0, averageTicket: 0, totalItemsSold: 0 }
            };
        }
    });

    ipcMain.handle('generate-sales-report-pdf', async (_event, data) => {
        try {
            requireRole('admin');
            return await pdfService.generateSalesReportPdf(data);
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });
}
