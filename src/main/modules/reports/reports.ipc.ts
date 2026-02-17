import { ipcMain } from "electron";
import { ReportsService } from "@main/modules/reports/services/reports.service";
import { PdfService } from "@main/shared/services/pdf.service";

const reportsService = new ReportsService();
const pdfService = new PdfService();

export function registerReportsHandlers() {
    ipcMain.handle('get-total-sales-metrics', async (_event, { startDate, endDate }) => {
        try {
            const metrics = await reportsService.getTotalSalesMetrics(
                startDate ? new Date(startDate) : null,
                endDate ? new Date(endDate) : null
            );
            return metrics;
        } catch (error: any) {
            console.error(error);
            return { error: error.message };
        }
    });

    ipcMain.handle('get-top-selling-products', async (_event, { startDate, endDate, limit }) => {
        try {
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
        return reportsService.getSalesOverTime(startDate ? new Date(startDate) : null, endDate ? new Date(endDate) : null, interval);
    });

    ipcMain.handle('get-least-selling-products', async (_event, { startDate, endDate, limit }) => {
         return { success: true, products: await reportsService.getLeastSellingProducts(startDate ? new Date(startDate) : null, endDate ? new Date(endDate) : null, limit) };
    });

    ipcMain.handle('get-dashboard-stats', async () => {
         return await reportsService.getDashboardStats();
    });

    ipcMain.handle('generate-sales-report-pdf', async (_event, data) => {
        return await pdfService.generateSalesReportPdf(data);
    });
}

