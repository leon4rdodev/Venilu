import { BrowserWindow, app, dialog } from "electron";
import path from "path";
import fs from "fs";
import { SettingsService } from "../../modules/settings/services/settings.service";
import { ReportsService } from "../../modules/reports/services/reports.service";

const settingsService = new SettingsService();
const reportsService = new ReportsService();

const CURRENCY_SYMBOLS: { [key: string]: string } = {
    DOP: 'RD$', USD: '$', EUR: '€', MXN: '$', COP: '$', PEN: 'S/',
    CLP: '$', ARS: '$', VES: 'Bs.', GTQ: 'Q', HNL: 'L', NIO: 'C$',
    CRC: '₡', PAB: 'B/.', BOB: 'Bs', UYU: '$U', PYG: '₲',
};

const PAYMENT_LABELS: { [key: string]: string } = {
    cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', credit: 'Crédito (pendiente)', other: 'Otro',
};

/** Escape user-controlled strings before interpolating them into report HTML. */
const esc = (v: unknown) => String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface ExportRange {
    startDate: string | null;
    endDate: string | null;
    interval?: 'day' | 'week' | 'month';
}

export class PdfService {

    private parseRange(data: ExportRange) {
        return {
            start: data?.startDate ? new Date(data.startDate) : null,
            end: data?.endDate ? new Date(data.endDate) : null,
            interval: (['day', 'week', 'month'] as const).includes(data?.interval as any)
                ? (data.interval as 'day' | 'week' | 'month')
                : 'day',
        };
    }

    private formatDateLabel(date: Date | null): string {
        if (!date || isNaN(date.getTime())) return 'Inicio';
        return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    }

    private async askDestination(defaultFileName: string, extension: 'pdf' | 'csv') {
        const win = BrowserWindow.getAllWindows()[0];
        const options = {
            title: extension === 'pdf' ? 'Guardar reporte PDF' : 'Guardar reporte CSV',
            defaultPath: path.join(app.getPath('downloads'), defaultFileName),
            filters: [extension === 'pdf'
                ? { name: 'PDF', extensions: ['pdf'] }
                : { name: 'CSV', extensions: ['csv'] }],
        };
        // Cast: this Electron version's typings declare the legacy string return
        const result = (win
            ? await (dialog.showSaveDialog as any)(win, options)
            : await (dialog.showSaveDialog as any)(options)) as { canceled: boolean; filePath?: string };
        if (result.canceled || !result.filePath) return null;
        return result.filePath;
    }

    private fileStamp(start: Date | null, end: Date | null) {
        const fmt = (d: Date | null, fallback: string) =>
            d && !isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : fallback;
        return `${fmt(start, 'inicio')}_a_${fmt(end, 'fin')}`;
    }

    /**
     * Generates the sales report PDF. Only the date range is accepted from the
     * renderer — every figure is recalculated here via ReportsService.
     */
    async generateSalesReportPdf(data: ExportRange): Promise<{ success: boolean; filePath?: string; canceled?: boolean; message?: string }> {
        let printWindow: BrowserWindow | null = null;
        try {
            const { start, end, interval } = this.parseRange(data);
            const [settings, report] = await Promise.all([
                settingsService.get(),
                reportsService.getFullReport(start, end, interval),
            ]);

            const symbol = CURRENCY_SYMBOLS[settings.currency] ?? `${settings.currency ?? '$'} `;
            const money = (n: number) => `${symbol}${(Number(n) || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            const pct = (n: number) => `${(Number(n) || 0).toFixed(1)}%`;
            const int = (n: number) => (Number(n) || 0).toLocaleString('es-DO');

            const m = report.metrics.current;
            const prev = report.metrics.previous;
            const trend = (cur: number, before?: number) => {
                if (before === undefined || before === null) return '';
                if (before === 0) return cur > 0 ? '+100%' : '0%';
                const change = ((cur - before) / before) * 100;
                return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
            };

            const metricCards = [
                { label: 'Total Ventas', value: money(m.totalAmount), delta: trend(m.totalAmount, prev?.totalAmount) },
                { label: 'Ganancia Neta', value: money(m.netProfit), delta: trend(m.netProfit, prev?.netProfit) },
                { label: 'Costo Total', value: money(m.totalCost), delta: trend(m.totalCost, prev?.totalCost) },
                { label: 'Margen Promedio', value: pct(m.averageMargin), delta: trend(m.averageMargin, prev?.averageMargin) },
                { label: 'Transacciones', value: int(m.totalSalesCount), delta: trend(m.totalSalesCount, prev?.totalSalesCount) },
                { label: 'Ticket Promedio', value: money(m.averageTicket), delta: trend(m.averageTicket, prev?.averageTicket) },
                { label: 'Unidades Vendidas', value: int(m.totalItemsSold), delta: trend(m.totalItemsSold, prev?.totalItemsSold) },
            ];

            const paymentTotal = report.paymentBreakdown.reduce((acc, r) => acc + r.total, 0);

            const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      margin: 0; padding: 14mm 14mm 18mm;
      color: #0a0a0a; font-size: 11px; line-height: 1.45;
    }
    .header { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 14px; border-bottom: 2px solid #0a0a0a; }
    .brand { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; margin: 0; }
    .doc-type { font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: #737373; margin-bottom: 2px; }
    .period { text-align: right; color: #525252; font-size: 10.5px; }
    .period strong { color: #0a0a0a; }
    h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #0a0a0a; margin: 22px 0 8px; padding-bottom: 5px; border-bottom: 1px solid #e5e5e5; }
    .metrics { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
    .metric { flex: 1 1 22%; min-width: 110px; border: 1px solid #e5e5e5; border-radius: 6px; padding: 8px 10px; }
    .metric .label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #737373; }
    .metric .value { font-size: 14px; font-weight: 700; letter-spacing: -0.01em; margin-top: 2px; font-variant-numeric: tabular-nums; }
    .metric .delta { font-size: 9px; color: #525252; margin-top: 1px; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; font-variant-numeric: tabular-nums; }
    th { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #737373; text-align: left; padding: 6px 8px; border-bottom: 1px solid #d4d4d4; }
    td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; }
    .num { text-align: right; white-space: nowrap; }
    .muted { color: #737373; }
    .rank { color: #a3a3a3; font-size: 10px; width: 18px; }
    .two-col { display: flex; gap: 16px; }
    .two-col > div { flex: 1; }
    .bar-track { background: #f0f0f0; border-radius: 99px; height: 5px; width: 100%; margin-top: 3px; }
    .bar-fill { background: #0a0a0a; border-radius: 99px; height: 5px; }
    .footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #e5e5e5; display: flex; justify-content: space-between; font-size: 9px; color: #a3a3a3; }
    .empty { color: #a3a3a3; font-style: italic; padding: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="doc-type">Reporte de Ventas</div>
      <h1 class="brand">${esc(settings.business_name || 'Venilu')}</h1>
    </div>
    <div class="period">
      Período<br><strong>${esc(this.formatDateLabel(start))} — ${esc(this.formatDateLabel(end))}</strong>
    </div>
  </div>

  <h2>Métricas Principales</h2>
  <div class="metrics">
    ${metricCards.map(c => `
      <div class="metric">
        <div class="label">${esc(c.label)}</div>
        <div class="value">${esc(c.value)}</div>
        ${c.delta ? `<div class="delta">${esc(c.delta)} vs período anterior</div>` : ''}
      </div>`).join('')}
  </div>

  <div class="two-col">
    <div>
      <h2>Métodos de Pago</h2>
      ${report.paymentBreakdown.length ? `
      <table>
        <thead><tr><th>Método</th><th class="num">Transacciones</th><th class="num">Total</th><th class="num">%</th></tr></thead>
        <tbody>
          ${report.paymentBreakdown.map(r => `
            <tr>
              <td>${esc(PAYMENT_LABELS[r.method] ?? r.method)}</td>
              <td class="num muted">${int(r.transactions)}</td>
              <td class="num">${money(r.total)}</td>
              <td class="num muted">${paymentTotal > 0 ? pct((r.total / paymentTotal) * 100) : '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>` : `<div class="empty">Sin ventas en el período.</div>`}
    </div>
    <div>
      <h2>Ventas por Categoría</h2>
      ${report.categoryBreakdown.length ? `
      <table>
        <thead><tr><th>Categoría</th><th class="num">Unidades</th><th class="num">Ingresos</th><th class="num">Margen</th></tr></thead>
        <tbody>
          ${report.categoryBreakdown.map(r => `
            <tr>
              <td>${esc(r.categoryName)}</td>
              <td class="num muted">${int(r.totalSold)}</td>
              <td class="num">${money(r.totalRevenue)}</td>
              <td class="num muted">${pct(r.margin)}</td>
            </tr>`).join('')}
        </tbody>
      </table>` : `<div class="empty">Sin ventas en el período.</div>`}
    </div>
  </div>

  <h2>Productos Más Vendidos</h2>
  ${report.topSellingProducts.length ? `
  <table>
    <thead><tr><th class="rank">#</th><th>Producto</th><th class="num">Unidades</th><th class="num">Ingresos</th><th class="num">Ganancia</th><th class="num">Margen</th></tr></thead>
    <tbody>
      ${report.topSellingProducts.map((p, i) => `
        <tr>
          <td class="rank">${i + 1}</td>
          <td>${esc(p.productName)}</td>
          <td class="num muted">${int(p.totalSold)}</td>
          <td class="num">${money(p.totalRevenue)}</td>
          <td class="num">${money(p.totalProfit)}</td>
          <td class="num muted">${pct(p.margin)}</td>
        </tr>`).join('')}
    </tbody>
  </table>` : `<div class="empty">Sin ventas en el período.</div>`}

  ${report.topCustomers.length ? `
  <h2>Mejores Clientes</h2>
  <table>
    <thead><tr><th class="rank">#</th><th>Cliente</th><th class="num">Compras</th><th class="num">Ticket Promedio</th><th class="num">Total Gastado</th></tr></thead>
    <tbody>
      ${report.topCustomers.map((c, i) => `
        <tr>
          <td class="rank">${i + 1}</td>
          <td>${esc(c.customerName)}</td>
          <td class="num muted">${int(c.totalTransactions)}</td>
          <td class="num muted">${money(c.averageTicket)}</td>
          <td class="num">${money(c.totalSpent)}</td>
        </tr>`).join('')}
    </tbody>
  </table>` : ''}

  <div class="footer">
    <span>${esc(settings.business_name || 'Venilu')} · Sistema POS Venilu</span>
    <span>Generado el ${new Date().toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' })}</span>
  </div>
</body>
</html>`;

            const fileName = `Reporte_Ventas_${this.fileStamp(start, end)}.pdf`;
            const filePath = await this.askDestination(fileName, 'pdf');
            if (!filePath) return { success: false, canceled: true };

            printWindow = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false } });
            await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

            const pdfData = await printWindow.webContents.printToPDF({
                printBackground: true,
                landscape: false,
            });

            fs.writeFileSync(filePath, pdfData);

            return { success: true, filePath, message: 'PDF generado exitosamente' };
        } catch (error: any) {
            console.error('PDF Generation Error:', error);
            return { success: false, message: error.message };
        } finally {
            printWindow?.close();
        }
    }

    /**
     * Exports the same server-recalculated report as a CSV file (spreadsheet-friendly,
     * UTF-8 BOM so Excel reads accents correctly).
     */
    async generateSalesReportCsv(data: ExportRange): Promise<{ success: boolean; filePath?: string; canceled?: boolean; message?: string }> {
        try {
            const { start, end, interval } = this.parseRange(data);
            const report = await reportsService.getFullReport(start, end, interval);

            const cell = (v: unknown) => {
                const s = String(v ?? '');
                return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
            };
            const row = (...cols: unknown[]) => cols.map(cell).join(',');
            const num = (n: number) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);

            const m = report.metrics.current;
            const lines: string[] = [];

            lines.push(row('Reporte de Ventas'));
            lines.push(row('Período', `${this.formatDateLabel(start)} — ${this.formatDateLabel(end)}`));
            lines.push('');
            lines.push(row('Métrica', 'Valor'));
            lines.push(row('Total Ventas', num(m.totalAmount)));
            lines.push(row('Ganancia Neta', num(m.netProfit)));
            lines.push(row('Costo Total', num(m.totalCost)));
            lines.push(row('Margen Promedio (%)', num(m.averageMargin)));
            lines.push(row('Transacciones', m.totalSalesCount));
            lines.push(row('Ticket Promedio', num(m.averageTicket)));
            lines.push(row('Unidades Vendidas', m.totalItemsSold));
            lines.push('');
            lines.push(row('Ventas por Período'));
            lines.push(row('Período', 'Ventas', 'Ganancia', 'Transacciones'));
            for (const p of report.salesOverTime) lines.push(row(p.period, num(p.totalSales), num(p.totalProfit), p.totalTransactions));
            lines.push('');
            lines.push(row('Métodos de Pago'));
            lines.push(row('Método', 'Transacciones', 'Total'));
            for (const p of report.paymentBreakdown) lines.push(row(PAYMENT_LABELS[p.method] ?? p.method, p.transactions, num(p.total)));
            lines.push('');
            lines.push(row('Ventas por Categoría'));
            lines.push(row('Categoría', 'Unidades', 'Ingresos', 'Ganancia', 'Margen (%)'));
            for (const c of report.categoryBreakdown) lines.push(row(c.categoryName, c.totalSold, num(c.totalRevenue), num(c.totalProfit), num(c.margin)));
            lines.push('');
            lines.push(row('Productos Más Vendidos'));
            lines.push(row('Producto', 'Unidades', 'Ingresos', 'Ganancia', 'Margen (%)'));
            for (const p of report.topSellingProducts) lines.push(row(p.productName, p.totalSold, num(p.totalRevenue), num(p.totalProfit), num(p.margin)));
            lines.push('');
            lines.push(row('Productos Menos Vendidos'));
            lines.push(row('Producto', 'Unidades', 'Ingresos', 'Ganancia', 'Margen (%)'));
            for (const p of report.leastSellingProducts) lines.push(row(p.productName, p.totalSold, num(p.totalRevenue), num(p.totalProfit), num(p.margin)));
            if (report.topCustomers.length) {
                lines.push('');
                lines.push(row('Mejores Clientes'));
                lines.push(row('Cliente', 'Compras', 'Ticket Promedio', 'Total Gastado'));
                for (const c of report.topCustomers) lines.push(row(c.customerName, c.totalTransactions, num(c.averageTicket), num(c.totalSpent)));
            }

            const fileName = `Reporte_Ventas_${this.fileStamp(start, end)}.csv`;
            const filePath = await this.askDestination(fileName, 'csv');
            if (!filePath) return { success: false, canceled: true };

            fs.writeFileSync(filePath, '\uFEFF' + lines.join('\n'), 'utf8');
            return { success: true, filePath, message: 'CSV generado exitosamente' };
        } catch (error: any) {
            console.error('CSV Generation Error:', error);
            return { success: false, message: error.message };
        }
    }
}
