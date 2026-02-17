const { BrowserWindow } = require('electron');

class ReceiptPrinter {

    /**
     * Get list of available printers using Electron's built-in API
     */
    static async getPrinters() {
        const win = BrowserWindow.getAllWindows()[0];
        if (!win) return [];
        try {
            return await win.webContents.getPrintersAsync();
        } catch {
            return [];
        }
    }

    /**
     * Get default printer name
     */
    static async getDefaultPrinter() {
        const printers = await ReceiptPrinter.getPrinters();
        const defaultPrinter = printers.find(p => p.isDefault);
        return defaultPrinter ? defaultPrinter.name : (printers.length > 0 ? printers[0].name : null);
    }

    /**
     * Print HTML content silently to a specific printer using a hidden window.
     */
    static async printHTML(html, printerName) {
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
                    pageSize: { width: 80000, height: 297000 } // 80mm width in microns
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

    /**
     * Generate receipt HTML for thermal printing (80mm paper)
     */
    static generateReceiptHTML(data, settings) {
        const {
            saleId,
            saleDate,
            items,
            total,
            paymentMethod,
            amountPaid,
            changeGiven,
            userName,
            shiftId
        } = data;

        const {
            business_name,
            business_address,
            business_phone,
            business_tax_id,
            paper_size
        } = settings;
        
        // Handle nulls
        const bName = business_name || 'Mi Negocio';
        const bAddress = business_address || '';
        const bPhone = business_phone || '';
        const bTaxId = business_tax_id || '';
        const paperWidth = paper_size || '80mm';
        const is58mm = paperWidth === '58mm';

        const paymentMethodLabels = {
            'cash': 'Efectivo',
            'card': 'Tarjeta',
            'transfer': 'Transferencia',
            'other': 'Otro'
        };

        const formatCurrency = (amount) => `$${(amount || 0).toFixed(2)}`;

        const itemsHTML = items.map(item => `
            <tr>
                <td class="qty">${item.quantity}</td>
                <td class="desc">${item.product_name || item.name}</td>
                <td class="price">${formatCurrency(item.price_at_sale || item.price)}</td>
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
            table-layout: fixed; /* Ensures columns stay fixed width */
        }
        th {
            text-align: left;
            border-bottom: 1px solid #000;
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
            overflow-wrap: break-word; /* Prevents overflow */
            word-wrap: break-word;
        }
        td.qty { text-align: center; }
        td.price { text-align: right; }
        
        .totals-section {
            margin-top: 5px;
            border-top: 1px solid #000;
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
            border-top: 1px dashed #000;
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
            color: #444;
        }
        .thank-you {
            font-weight: bold;
            font-size: ${is58mm ? '11px' : '12px'};
            margin-bottom: 5px;
            text-transform: uppercase;
        }
        .pos-brand {
            font-size: 9px;
            color: #888;
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="business-name">${bName}</div>
        ${bAddress ? `<div class="info-row">${bAddress}</div>` : ''}
        ${bPhone ? `<div class="info-row">Tel: ${bPhone}</div>` : ''}
        ${bTaxId ? `<div class="info-row">RNC: ${bTaxId}</div>` : ''}
    </div>

    <div class="divider"></div>

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
            <span>${userName}</span>
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
        <!-- Descuentos e Impuestos irían aquí si los hubiera -->
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
        <div>Revise su mercancía antes de salir.</div>
        <div>No se aceptan devoluciones después de 24h.</div>
        <div class="pos-brand">Sistema POS Venilu</div>
    </div>
</body>
</html>`;
    }

    /**
     * Full receipt print workflow: fetch data, generate HTML, and print.
     */
    static async printReceipt(saleId) {
        const { getSales, getSaleItems } = require('./db/sales');
        const { getSettings, getUsers } = require('./db/index');

        // Get sale details
        const saleResult = await getSales();
        if (!saleResult.success) {
            return { success: false, message: 'No se pudo obtener los datos de la venta' };
        }

        const sale = saleResult.sales.find(s => s.id === saleId);
        if (!sale) {
            return { success: false, message: 'Venta no encontrada' };
        }

        // Get sale items
        const itemsResult = await getSaleItems(saleId);
        if (!itemsResult.success) {
            return { success: false, message: 'No se pudieron obtener los productos de la venta' };
        }

        // Get settings
        const settingsResult = await getSettings();
        const settings = settingsResult.success ? settingsResult.settings : {};

        // Get user info if available
        let userName = '';
        if (sale.user_id) {
            const usersResult = await getUsers();
            if (usersResult.success) {
                const user = usersResult.users.find(u => u.id === sale.user_id);
                if (user) userName = user.name || user.username;
            }
        }

        // Prepare data
        const receiptData = {
            saleId: sale.id,
            saleDate: sale.sale_date,
            items: itemsResult.items,
            subtotal: sale.total_amount,
            total: sale.total_amount,
            paymentMethod: sale.payment_method,
            amountPaid: sale.amount_paid,
            changeGiven: sale.change_given,
            userName,
            shiftId: sale.shift_id
        };

        // Generate HTML
        const html = ReceiptPrinter.generateReceiptHTML(receiptData, settings);

        // Print
        const printerName = settings.default_printer || await ReceiptPrinter.getDefaultPrinter();
        console.log(`Printing receipt #${saleId} to ${printerName || 'default printer'}`);

        return await ReceiptPrinter.printHTML(html, printerName);
    }

    /**
     * Generate and print a test page
     */
    static async testPrint(printerName) {
        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        @page { size: 80mm auto; margin: 0; }
        * { margin: 0; padding: 0; }
        body {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            width: 72mm;
            padding: 4mm;
            text-align: center;
        }
        .title { font-size: 14px; font-weight: bold; margin-bottom: 8px; }
        .separator { border: none; border-top: 1px dashed #000; margin: 8px 0; }
    </style>
</head>
<body>
    <div class="title">PRUEBA DE IMPRESION</div>
    <div>Sistema POS Bocado</div>
    <hr class="separator">
    <div>Si puedes leer esto,</div>
    <div>la impresora funciona correctamente.</div>
    <br>
    <div>${new Date().toLocaleString('es-DO')}</div>
</body>
</html>`;

        return await ReceiptPrinter.printHTML(html, printerName);
    }
}

module.exports = ReceiptPrinter;
