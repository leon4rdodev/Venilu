import { app, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { SalesService } from '../../modules/sales/services/sales.service';
import { SettingsService } from '../../modules/settings/services/settings.service';
import { formatQty, unitDef } from '@shared/units';
import { ncfCompleto, esElectronico } from '@shared/ncf';
import QRCode from 'qrcode';
import { AppDataSource } from '@main/config/data-source';
import { EcfDocument } from '../../modules/ecf/entities/ecf-document.entity';
import { LEYENDA_CONTINGENCIA, type DatosRI } from '../../modules/ecf/ri/representacion-impresa';
import { ecfDeVenta, prepararRI } from '../../modules/ecf/ri/ri.service';

/** Resultado de imprimir: `aviso` explica si el e-CF no quedó completo. */
export interface ResultadoImpresion {
    success: boolean;
    message: string;
    aviso?: string | null;
}

/**
 * QR del timbre como SVG. Informe Técnico §18.2.3: "tamaño mínimo de 22 x 22
 * mm, con un margen de 3mm en los lados" — el CSS lo imprime a 25 mm.
 */
async function qrSvg(url: string): Promise<string> {
    return QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
}
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
        // Representación Impresa del e-CF (null en ventas sin comprobante).
        const { ri, qr, contingencia } = data as { ri?: DatosRI | null; qr?: string | null; contingencia?: boolean };

        const {
            business_name,
            business_address,
            business_phone,
            business_tax_id,
            paper_size,
            logo_filename
        } = settings;
        
        // Con e-CF, el encabezado del emisor sale del XML firmado (§18.2.1-B).
        const bName = ri ? (ri.emisor.nombreComercial || ri.emisor.razonSocial) : (business_name || 'Mi Negocio');
        const bRazonSocial = ri && ri.emisor.nombreComercial ? ri.emisor.razonSocial : '';
        const bAddress = ri ? ri.emisor.direccion : (business_address || '');
        const bUbicacion = ri ? [ri.emisor.municipio, ri.emisor.provincia].filter(Boolean).join(', ') : '';
        const bPhone = business_phone || '';
        const bTaxId = ri ? ri.emisor.rnc : (business_tax_id || '');
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

        const itemsHTML = items.map((item: any) => {
            // Cantidad con abreviatura de unidad para medidas fraccionables:
            // "0.5 lb". Los productos por unidad quedan como antes: solo el número.
            const qty = formatQty(Number(item.quantity) || 0);
            const unit = unitDef(item.unit);
            const qtyLabel = unit.value === 'unidad' ? qty : `${qty} ${unit.abbr}`;
            return `
            <tr>
                <td class="qty">${qtyLabel}</td>
                <td class="desc">${esc(item.product_name || item.name)}</td>
                <td class="price">${formatCurrency(item.total_price ?? (Number(item.unit_price) || 0) * (Number(item.quantity) || 0))}</td>
            </tr>
        `;
        }).join('');

        // ── Representación Impresa del e-CF (Informe Técnico §18) ──────────
        const money = (v: string | null | undefined) => formatCurrency(Number(v ?? 0));
        const riItemsHTML = ri ? ri.lineas.map((l) => `
            <tr>
                <td class="qty">${esc(l.cantidad)}</td>
                <td class="desc">${l.exento ? '<b>E</b> ' : ''}${esc(l.descripcion)}
                    <div class="sub">@ ${money(l.precio)}${l.descuento ? ` · Desc. -${money(l.descuento)}` : ''}</div>
                </td>
                <td class="price">${money(l.valor)}</td>
            </tr>`).join('') : '';

        const riHeaderHTML = ri ? `
    <div class="ecf-head">
        <div class="ecf-tipo">${esc(ri.tipoNombre)}</div>
        <div>e-NCF: <b>${esc(ri.encf)}</b></div>
        ${ri.fechaVencimiento ? `<div>Fecha Vencimiento: ${esc(ri.fechaVencimiento)}</div>` : ''}
        ${ri.ncfModificado ? `<div>${ri.tipo === 34 ? 'e-NCF Modificado' : 'NCF Reemplazado'}: ${esc(ri.ncfModificado)}</div>` : ''}
        ${ri.codigoModificacionNombre ? `<div>Código de Modificación: ${esc(ri.codigoModificacionNombre)}</div>` : ''}
        <div>Fecha Emisión: ${esc(ri.fechaEmision)}</div>
    </div>
    ${ri.comprador.rnc || ri.comprador.nombre ? `
    <div class="ticket-info">
        ${ri.comprador.nombre ? `<div class="ticket-row"><span>Razón Social Cliente:</span><span>${esc(ri.comprador.nombre)}</span></div>` : ''}
        ${ri.comprador.rnc ? `<div class="ticket-row"><span>RNC Cliente:</span><span>${esc(ri.comprador.rnc)}</span></div>` : ''}
    </div>` : ''}
    <div class="divider"></div>` : '';

        const riTotalsHTML = ri ? `
        ${ri.totales.gravado ? `<div class="total-row"><span>Subtotal Gravado</span><span>${money(ri.totales.gravado)}</span></div>` : ''}
        ${ri.totales.exento ? `<div class="total-row"><span>Subtotal Exento</span><span>${money(ri.totales.exento)}</span></div>` : ''}
        ${ri.totales.itbis ? `<div class="total-row"><span>Total ITBIS</span><span>${money(ri.totales.itbis)}</span></div>` : ''}
        <div class="total-row final"><span>TOTAL</span><span>${money(ri.totales.total)}</span></div>` : '';

        const riQrHTML = ri ? `
    <div class="ecf-qr">
        ${qr ? `<div class="qr-box">${qr}</div>` : ''}
        <div>Código de Seguridad: <b>${esc(ri.codigoSeguridad)}</b></div>
        <div>Fecha de Firma Digital: ${esc(ri.fechaFirma)}</div>
    </div>
    ${contingencia ? `<div class="ecf-contingencia">${esc(LEYENDA_CONTINGENCIA)}</div>` : ''}` : '';

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
        td .sub {
            font-size: ${is58mm ? '8px' : '9px'};
            color: #333;
        }
        .ecf-head {
            text-align: center;
            margin: 2px 0 6px;
            font-size: ${is58mm ? '10px' : '11px'};
        }
        .ecf-tipo {
            font-weight: 800;
            font-size: ${is58mm ? '11px' : '12px'};
            margin-bottom: 2px;
        }
        .ecf-qr {
            text-align: center;
            margin-top: 10px;
            font-size: ${is58mm ? '9px' : '10px'};
        }
        .qr-box {
            width: 25mm;
            height: 25mm;
            padding: 3mm;
            margin: 0 auto 4px;
            box-sizing: content-box;
            background: #fff;
        }
        .qr-box svg {
            width: 25mm;
            height: 25mm;
            display: block;
        }
        .ecf-contingencia {
            margin-top: 8px;
            font-size: ${is58mm ? '9px' : '10px'};
            font-style: italic;
            font-weight: 600;
            text-align: center;
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
        ${bRazonSocial ? `<div class="info-row">${esc(bRazonSocial)}</div>` : ''}
        ${ri && bTaxId ? `<div class="info-row">RNC: ${esc(bTaxId)}</div>` : ''}
        ${bAddress ? `<div class="info-row">${esc(bAddress)}</div>` : ''}
        ${bUbicacion ? `<div class="info-row">${esc(bUbicacion)}</div>` : ''}
        ${bPhone ? `<div class="info-row">Tel: ${esc(bPhone)}</div>` : ''}
        ${!ri && bTaxId ? `<div class="info-row">RNC: ${esc(bTaxId)}</div>` : ''}
    </div>

    <div class="divider"></div>

    ${riHeaderHTML}
    ${ncf && !ri ? `
    <div style="text-align:center; font-weight:bold; margin: 2px 0 4px;">
        ${esc(ncfCompleto(ncfType))}<br>
        ${esElectronico(ncfType) ? 'e-NCF' : 'NCF'}: ${esc(ncf)}
    </div>
    ${fiscalCustomerRnc ? `
    <div class="ticket-info">
        <div class="ticket-row"><span>RNC/Cédula Cliente:</span><span>${esc(fiscalCustomerRnc)}</span></div>
        ${fiscalCustomerName ? `<div class="ticket-row"><span>Cliente:</span><span>${esc(fiscalCustomerName)}</span></div>` : ''}
    </div>` : ''}
    <div class="divider"></div>
    ` : ''}

    <div class="ticket-info">
        ${saleId ? `<div class="ticket-row">
            <span>Ticket:</span>
            <span style="font-weight: bold">#${esc(saleId)}</span>
        </div>` : ''}
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
                <th class="desc">DESCRIPCIÓN</th>
                <th class="price">${ri ? 'VALOR' : 'TOTAL'}</th>
            </tr>
        </thead>
        <tbody>
            ${ri ? riItemsHTML : itemsHTML}
        </tbody>
    </table>

    <div class="totals-section">
        ${riTotalsHTML}
        ${ri ? '' : `
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
        </div>`}
    </div>

    ${paymentMethod ? `<div class="payment-section">
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
    </div>` : ''}
    ${riQrHTML}

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

    async printReceipt(saleId: string): Promise<ResultadoImpresion> {
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

        // e-CF: Representación Impresa (firma en el momento y, si se puede,
        // transmite; si no llega a la DGII, sale con la leyenda de contingencia).
        let aviso: string | null = null;
        let fiscal: { ri: DatosRI | null; qr: string | null; contingencia: boolean } = {
            ri: null, qr: null, contingencia: false,
        };
        if (sale.ncf && esElectronico(sale.ncf_type)) {
            const doc = await ecfDeVenta(sale.id, sale.ncf);
            if (doc) {
                const res = await prepararRI(doc, { transmitir: true });
                aviso = res.aviso;
                if (res.datos) {
                    fiscal = { ri: res.datos, qr: await qrSvg(res.datos.urlQr), contingencia: res.contingencia };
                }
            }
        }

        const html = this.generateReceiptHTML({ ...receiptData, ...fiscal }, settings);
        const printerName = settings.printer_name || await this.getDefaultPrinter();
        const widthMicrons = settings.paper_size === '58mm' ? 58000 : 80000;

        const r = await this.printHTML(html, printerName, widthMicrons) as ResultadoImpresion;
        return { ...r, aviso };
    }

    /**
     * Representación Impresa de un e-CF cualquiera (factura o Nota de
     * Crédito), desde la pantalla de Facturación Electrónica. No transmite:
     * el estado lo lleva el worker.
     */
    async printEcf(ecfId: string): Promise<ResultadoImpresion> {
        const doc = await AppDataSource.getRepository(EcfDocument).findOneBy({ id: ecfId });
        if (!doc) return { success: false, message: 'Comprobante e-CF no encontrado' };

        const res = await prepararRI(doc);
        if (!res.datos) {
            return { success: false, message: res.aviso ?? 'El comprobante no se puede imprimir todavía.' };
        }

        const settings = await settingsService.get();
        const html = this.generateReceiptHTML({
            saleId: doc.sale_id,
            saleDate: doc.created_at,
            items: [],
            ri: res.datos,
            qr: await qrSvg(res.datos.urlQr),
            contingencia: res.contingencia,
        }, settings);
        const printerName = settings.printer_name || await this.getDefaultPrinter();
        const widthMicrons = settings.paper_size === '58mm' ? 58000 : 80000;
        const r = await this.printHTML(html, printerName, widthMicrons) as ResultadoImpresion;
        return { ...r, aviso: res.aviso };
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
