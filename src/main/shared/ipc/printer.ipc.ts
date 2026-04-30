import { ipcMain } from 'electron';
import { PrinterService } from '@main/shared/services/printer.service';
import { requirePermission } from '@main/shared/session';
import { UsersService } from '@main/modules/users/services/users.service';

const printerService = new PrinterService();

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
  ipcMain.handle('test-print', async (_event, { printerName: _printerName }) => {
    try {
      const usersService = new UsersService();
      const onboarding = await usersService.checkOnboardingStatus();
      if (onboarding.completed) requirePermission('settings:printer');
      // TODO: send a test page to the selected printer
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });
}
