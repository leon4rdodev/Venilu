import { app, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { SalesService } from '../../modules/sales/services/sales.service';
import { SettingsService } from '../../modules/settings/services/settings.service';
// import { UsersService } from '../../modules/users/services/users.service';

const salesService = new SalesService();
const settingsService = new SettingsService();

export class PrinterService {
    async getPrinters() {
        const win = BrowserWindow.getAllWindows()[0];
        if (!win) return [];
        try {
            return await win.webContents.getPrintersAsync() as any[];
        } catch {
            return [];
        }
    }

    async getDefaultPrinter() {
        const printers = await this.getPrinters();
        const defaultPrinter = printers.find(p => p.isDefault);
        return defaultPrinter ? defaultPrinter.name : (printers.length > 0 ? printers[0].name : null);
    }

    async printHTML(html: string, printerName: string | null, widthMicrons: number = 80000) {
        const printWindow = new BrowserWindow({
            show: false,
            webPreferences: { nodeIntegration: false, contextIsolation: true }
        });

        await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

        // Small delay to ensure CSS/layout is fully rendered
        await new Promise(r => setTimeout(r, 200));

        return new Promise((resolve) => {
            printWindow.webContents.print(
                {
                    silent: true,
                    deviceName: printerName || '',
                    printBackground: true,
                    margins: { marginType: 'none' },
                    pageSize: { width: widthMicrons, height: 297000 } // paper width in microns
                },
                (success, failureReason) => {
                    printWindow.close();
                    if (success) {
                        resolve({ success: true, message: 'Impresión enviada correctamente' });
                    } else {
                        resolve({ success: false, message: failureReason || 'Error al imprimir' });
                    }
                }
            );
        });
    }

    generateReceiptHTML(data: any, settings: any) {
        const {
            saleId,
            saleDate,
            items,
            subtotal,
            discountAmount,
            total,
            paymentMethod,
            amountPaid,
            changeGiven,
            userName,
            ncf,
            ncfType,
            fiscalCustomerRnc,
            fiscalCustomerName,
            itbisAmount,
            // _shiftId // unused but kept for compatibility
        } = data;

        const NCF_LABELS: { [key: string]: string } = {
            B01: 'FACTURA DE CRÉDITO FISCAL',
            B02: 'FACTURA DE CONSUMO',
        };

        const {
            business_name,
            business_address,
            business_phone,
            business_tax_id,
            paper_size,
            logo_filename
        } = settings;
        
        const bName = business_name || 'Mi Negocio';
        const bAddress = business_address || '';
        const bPhone = business_phone || '';
        const bTaxId = business_tax_id || '';
        const paperWidth = paper_size || '80mm';
        const is58mm = paperWidth === '58mm';
        
        let logoBase64 = '';
        if (logo_filename) {
            try {
                const filePath = path.join(app.getPath('userData'), path.basename(logo_filename));
                if (fs.existsSync(filePath)) {
                    const buffer = fs.readFileSync(filePath);
                    const ext = path.extname(logo_filename).substring(1) || 'png';
                    logoBase64 = `data:image/${ext};base64,${buffer.toString('base64')}`;
                }
            } catch (e) {
                console.error('Error loading logo for receipt:', e);
            }
        }

        const paymentMethodLabels: { [key: string]: string } = {
            'cash': 'Efectivo',
            'card': 'Tarjeta',
            'transfer': 'Transferencia',
            'credit': 'Credito',
            'other': 'Otro'
        };

        const CURRENCY_SYMBOLS: { [key: string]: string } = {
            DOP: 'RD$', USD: '$', EUR: '€', MXN: '$', COP: '$', PEN: 'S/',
            CLP: '$', ARS: '$', VES: 'Bs.', GTQ: 'Q', HNL: 'L', NIO: 'C$',
            CRC: '₡', PAB: 'B/.', BOB: 'Bs', UYU: '$U', PYG: '₲',
        };
        const symbol = CURRENCY_SYMBOLS[settings.currency] ?? `${settings.currency ?? '$'} `;
        const formatCurrency = (amount: number) => `${symbol}${(Number(amount) || 0).toFixed(2)}`;

        // Escape user-controlled strings so a product/business name with HTML
        // characters can't break (or inject into) the ticket markup.
        const esc = (v: unknown) => String(v ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

        const itemsHTML = items.map((item: any) => `
            <tr>
                <td class="qty">${Number(item.quantity) || 0}</td>
                <td class="desc">${esc(item.product_name || item.name)}</td>
                <td class="price">${formatCurrency(item.total_price ?? (Number(item.unit_price) || 0) * (Number(item.quantity) || 0))}</td>
            </tr>
        `).join('');

        return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @page {
            size: ${paperWidth} auto;
            margin: 0;
        }
        * {
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: ${is58mm ? '9px' : '10px'};
            width: ${paperWidth};
            margin: 0;
            padding: ${is58mm ? '2mm' : '2mm 4mm 4mm 4mm'};
            color: #000;
            line-height: 1.2;
        }
        .header {
            text-align: center;
            margin-bottom: ${is58mm ? '5px' : '10px'};
        }
        .logo-img {
            max-width: 60%;
            height: auto;
            margin: 0 auto 8px;
            display: block;
        }
        .business-name {
            font-size: ${is58mm ? '14px' : '16px'};
            font-weight: 800;
            text-transform: uppercase;
            margin-bottom: 4px;
            line-height: 1.1;
            word-wrap: break-word;
        }
        .info-row {
            font-size: ${is58mm ? '10px' : '11px'};
            margin-bottom: 2px;
            word-wrap: break-word;
        }
        .divider {
            border-top: 1px dashed #000;
            margin: 8px 0;
            width: 100%;
        }
        .ticket-info {
            font-size: ${is58mm ? '10px' : '11px'};
            margin-bottom: 8px;
        }
        .ticket-row {
            display: flex;
            justify-content: space-between;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
            table-layout: fixed;
        }
        th {
            text-align: left;
            border-bottom: 1px dashed #000;
            padding-bottom: 4px;
            font-size: ${is58mm ? '9px' : '10px'};
            font-weight: 700;
            text-transform: uppercase;
        }
        th.qty { width: 15%; text-align: center; } 
        th.desc { width: 55%; } 
        th.price { width: 30%; text-align: right; }
        
        td {
            padding: 4px 0;
            vertical-align: top;
            font-size: ${is58mm ? '10px' : '11px'};
            overflow-wrap: break-word;
            word-wrap: break-word;
        }
        td.qty { text-align: center; }
        td.price { text-align: right; }
        
        .totals-section {
            margin-top: 5px;
            border-top: 1px dashed #000;
            padding-top: 5px;
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
            font-size: ${is58mm ? '11px' : '12px'};
        }
        .total-row.final {
            font-size: ${is58mm ? '14px' : '16px'};
            font-weight: 800;
            margin-top: 5px;
            padding-top: 5px;
        }
        .payment-section {
            margin-top: 10px;
            font-size: ${is58mm ? '10px' : '11px'};
        }
        .footer {
            text-align: center;
            margin-top: 15px;
            font-size: ${is58mm ? '9px' : '10px'};
        }
        .thank-you {
            font-weight: bold;
            font-size: ${is58mm ? '11px' : '12px'};
            margin-bottom: 5px;
            text-transform: uppercase;
        }
        .pos-brand {
            font-size: 8px;
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <div class="header">
        ${logoBase64 ? `<img src="${logoBase64}" class="logo-img" alt="Logo">` : ''}
        <div class="business-name">${esc(bName)}</div>
        ${bAddress ? `<div class="info-row">${esc(bAddress)}</div>` : ''}
        ${bPhone ? `<div class="info-row">Tel: ${esc(bPhone)}</div>` : ''}
        ${bTaxId ? `<div class="info-row">RNC: ${esc(bTaxId)}</div>` : ''}
    </div>

    <div class="divider"></div>

    ${ncf ? `
    <div style="text-align:center; font-weight:bold; margin: 2px 0 4px;">
        ${esc(NCF_LABELS[ncfType] || 'COMPROBANTE FISCAL')}<br>
        NCF: ${esc(ncf)}
    </div>
    ${fiscalCustomerRnc ? `
    <div class="ticket-info">
        <div class="ticket-row"><span>RNC/Cédula Cliente:</span><span>${esc(fiscalCustomerRnc)}</span></div>
        ${fiscalCustomerName ? `<div class="ticket-row"><span>Cliente:</span><span>${esc(fiscalCustomerName)}</span></div>` : ''}
    </div>` : ''}
    <div class="divider"></div>
    ` : ''}

    <div class="ticket-info">
        <div class="ticket-row">
            <span>Ticket:</span>
            <span style="font-weight: bold">#${saleId}</span>
        </div>
        <div class="ticket-row">
            <span>Fecha:</span>
            <span>${new Date(saleDate).toLocaleDateString('es-DO')} ${new Date(saleDate).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
        </div>
        ${userName ? `
        <div class="ticket-row">
            <span>Cajero:</span>
            <span>${esc(userName)}</span>
        </div>` : ''}
    </div>

    <div class="divider"></div>

    <table>
        <thead>
            <tr>
                <th class="qty">CANT</th>
                <th class="desc">DESCRIPCION</th>
                <th class="price">TOTAL</th>
            </tr>
        </thead>
        <tbody>
            ${itemsHTML}
        </tbody>
    </table>

    <div class="totals-section">
        ${discountAmount > 0 ? `
        <div class="total-row">
            <span>Subtotal</span>
            <span>${formatCurrency(subtotal)}</span>
        </div>
        <div class="total-row">
            <span>Descuento</span>
            <span>-${formatCurrency(discountAmount)}</span>
        </div>
        <div class="divider" style="margin: 4px 0;"></div>
        ` : ''}
        ${ncf && itbisAmount !== undefined && itbisAmount !== null ? `
        <div class="total-row">
            <span>Subtotal sin ITBIS</span>
            <span>${formatCurrency(Number(total) - Number(itbisAmount))}</span>
        </div>
        <div class="total-row">
            <span>ITBIS incluido</span>
            <span>${formatCurrency(Number(itbisAmount))}</span>
        </div>` : ''}
        <div class="total-row final">
            <span>TOTAL</span>
            <span>${formatCurrency(total)}</span>
        </div>
    </div>

    <div class="payment-section">
        <div class="ticket-row">
            <span>Forma de Pago:</span>
            <span style="font-weight: 600">${paymentMethodLabels[paymentMethod] || paymentMethod}</span>
        </div>
        ${amountPaid !== undefined ? `
        <div class="ticket-row">
            <span>Recibido:</span>
            <span>${formatCurrency(amountPaid)}</span>
        </div>` : ''}
        ${changeGiven !== undefined && changeGiven > 0 ? `
        <div class="ticket-row">
            <span>Cambio:</span>
            <span>${formatCurrency(changeGiven)}</span>
        </div>` : ''}
    </div>

    <div class="footer">
        <div class="thank-you">*** Gracias por su compra ***</div>
        ${settings.receipt_footer
            ? String(settings.receipt_footer).split('\n').filter(Boolean).map((line: string) => `<div>${esc(line)}</div>`).join('')
            : `<div>Revise su mercancía antes de salir.</div>
        <div>No se aceptan devoluciones después de 24h.</div>`}
        <div class="pos-brand">Sistema POS Venilu</div>
    </div>
</body>
</html>`;
    }

    async printReceipt(saleId: string) {
        // Get sale details with relations
        const sale = await salesService.findOne(saleId);
        
        if (!sale) {
            return { success: false, message: 'Venta no encontrada' };
        }

        const items = await salesService.getSaleItems(saleId);
        const settings = await settingsService.get();

        const userName = sale.user?.name || sale.user?.username || 'Cajero';

        const receiptData = {
            saleId: sale.id,
            saleDate: sale.created_at,
            items: items,
            subtotal: sale.subtotal || sale.total_amount,
            discountAmount: sale.discount_amount || 0,
            total: sale.total_amount,
            paymentMethod: sale.payment_method,
            amountPaid: sale.amount_paid,
            changeGiven: sale.change_given,
            userName,
            shiftId: sale.shift_id,
            // Comprobante fiscal (RD)
            ncf: sale.ncf,
            ncfType: sale.ncf_type,
            fiscalCustomerRnc: sale.fiscal_customer_rnc,
            fiscalCustomerName: sale.fiscal_customer_name,
            itbisAmount: sale.itbis_amount,
        };

        const html = this.generateReceiptHTML(receiptData, settings);
        const printerName = settings.printer_name || await this.getDefaultPrinter();
        const widthMicrons = settings.paper_size === '58mm' ? 58000 : 80000;

        return await this.printHTML(html, printerName, widthMicrons);
    }

    /** Prints a small test page so the user can verify the printer setup. */
    async printTest(printerName?: string | null) {
        const settings = await settingsService.get();
        const paper = settings.paper_size || '80mm';
        const widthMicrons = paper === '58mm' ? 58000 : 80000;
        const targetName = printerName || settings.printer_name || await this.getDefaultPrinter();

        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
            @page { size: ${paper} auto; margin: 0; }
            body { font-family: sans-serif; width: ${paper}; margin: 0; padding: 4mm; text-align: center; font-size: 11px; color: #000; }
            h1 { font-size: 14px; margin: 0 0 6px; }
        </style></head><body>
            <h1>VENILU</h1>
            <div>✓ Prueba de impresión correcta</div>
            <div>${new Date().toLocaleString('es-DO')}</div>
            <div style="margin-top:6px">Impresora: ${String(targetName || 'predeterminada').replace(/</g, '&lt;')}</div>
            <div>Papel: ${paper}</div>
        </body></html>`;

        return await this.printHTML(html, targetName, widthMicrons);
    }
}
