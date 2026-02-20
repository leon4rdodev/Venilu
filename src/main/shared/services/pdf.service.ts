import { BrowserWindow, app } from "electron";
import path from "path";
import fs from "fs";
import { SettingsService } from "../../modules/settings/services/settings.service";

const settingsService = new SettingsService();

export class PdfService {
    async generateSalesReportPdf(data: any): Promise<{ success: boolean; filePath?: string; message?: string }> {
        try {
            const { startDate, endDate, metrics, topSellingProducts } = data;
            const settings = await settingsService.get();

            const win = BrowserWindow.getAllWindows()[0];
            if (!win) {
                throw new Error('No window available');
            }

            const formatCurrency = (amount: number) => {
                return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(amount || 0);
            };

            const formatDate = (dateStr: string | Date | null) => {
                if (!dateStr) return 'N/A';
                const date = new Date(dateStr);
                return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
            };

            const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; padding: 20mm; color: #333; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
    h1 { margin: 0; font-size: 24px; }
    .subtitle { color: #666; }
    .metric-card { border: 1px solid #ddd; padding: 15px; display: inline-block; width: 45%; margin: 5px; vertical-align: top; }
    .value { font-size: 20px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 10px; border-bottom: 1px solid #ddd; text-align: left; }
    th { background: #f3f4f6; }
    .text-right { text-align: right; }
    .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${settings.business_name || 'Reporte de Ventas'}</h1>
    <div class="subtitle">Período: ${formatDate(startDate)} - ${formatDate(endDate)}</div>
  </div>

  <h2>Métricas Principales</h2>
  <div>
    <div class="metric-card"><div class="label">Total Ventas</div><div class="value">${formatCurrency(metrics.current.totalAmount)}</div></div>
    <div class="metric-card"><div class="label">Ganancia Neta</div><div class="value">${formatCurrency(metrics.current.netProfit)}</div></div>
  </div>

  ${topSellingProducts?.length ? `
  <h2>Productos Más Vendidos</h2>
  <table>
    <thead><tr><th>Producto</th><th class="text-right">Cantidad</th><th class="text-right">Ingresos</th></tr></thead>
    <tbody>
      ${topSellingProducts.map((p: any) => `<tr><td>${p.productName}</td><td class="text-right">${p.totalSold}</td><td class="text-right">${formatCurrency(p.totalRevenue)}</td></tr>`).join('')}
    </tbody>
  </table>` : ''}

  <div class="footer">
    <p>${settings.business_name || ''}</p>
    <p>Generado el ${new Date().toLocaleDateString('es-ES')}</p>
  </div>
</body>
</html>`;

            const printWindow = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false } });
            await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

            const startDateStr = startDate ? new Date(startDate).toLocaleDateString('es-ES').replace(/\//g, '-') : 'inicio';
            const endDateStr = endDate ? new Date(endDate).toLocaleDateString('es-ES').replace(/\//g, '-') : 'fin';
            const fileName = `Reporte_Ventas_${startDateStr}_a_${endDateStr}.pdf`;
            const downloadsPath = app.getPath('downloads');
            const filePath = path.join(downloadsPath, fileName);

            const pdfData = await printWindow.webContents.printToPDF({
                printBackground: true,
                landscape: false
            });

            fs.writeFileSync(filePath, pdfData);
            printWindow.close();

            return { success: true, filePath, message: 'PDF generado exitosamente' };
        } catch (error: any) {
            console.error('PDF Generation Error:', error);
            return { success: false, message: error.message };
        }
    }
}
