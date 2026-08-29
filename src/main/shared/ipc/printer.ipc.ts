import { ipcMain } from 'electron';
import { PrinterService } from '@main/shared/services/printer.service';
import { requirePermission } from '@main/shared/session';
import { UsersService } from '@main/modules/users/services/users.service';
import { SettingsService } from '@main/modules/settings/services/settings.service';

const printerService = new PrinterService();
const settingsService = new SettingsService();

export function registerPrinterHandlers() {
  /**
   * During onboarding, there is no session yet — allow without auth.
   * Once onboarding is done, require pos:access.
   */
  ipcMain.handle('get-printers', async () => {
    try {
      const usersService = new UsersService();
      const onboarding = await usersService.checkOnboardingStatus();
      if (onboarding.completed) requirePermission('pos:access');
      const printers = await printerService.getPrinters();
      return { success: true, printers };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('print-receipt', async (_event, { saleId }) => {
    try {
      requirePermission('pos:access');
      await printerService.printReceipt(saleId);
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  /** Allowed during onboarding to test the printer before first login */

  /**
   * Imprime etiquetas de producto (HTML generado en el renderer con los
   * códigos de barras ya renderizados como SVG). Usa la impresora y el ancho
   * de papel configurados.
   */
  ipcMain.handle('print-labels', async (_event, { html } = {}) => {
    try {
      requirePermission('inventory:view');
      if (typeof html !== 'string' || !html || html.length > 2_000_000) {
        throw new Error('Contenido de etiquetas inválido');
      }
      const settings = await settingsService.get();
      const printerName = settings.printer_name || await printerService.getDefaultPrinter();
      const widthMicrons = settings.paper_size === '58mm' ? 58000 : 80000;
      return await printerService.printHTML(html, printerName, widthMicrons);
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('test-print', async (_event, payload) => {
    try {
      const usersService = new UsersService();
      const onboarding = await usersService.checkOnboardingStatus();
      if (onboarding.completed) requirePermission('settings:printer');

      const printerName = typeof payload?.printerName === 'string' ? payload.printerName : null;
      return await printerService.printTest(printerName);
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });
}
