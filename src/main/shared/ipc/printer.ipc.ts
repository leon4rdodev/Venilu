import { ipcMain } from "electron";
import { PrinterService } from "@main/shared/services/printer.service";

const printerService = new PrinterService();

export function registerPrinterHandlers() {
    ipcMain.handle('get-printers', async () => {
        try {
            const printers = await printerService.getPrinters();
            return { success: true, printers };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('print-receipt', async (_event, { saleId }) => {
        try {
            await printerService.printReceipt(saleId);
            return { success: true };
        } catch (error: any) {
             return { success: false, message: error.message };
        }
    });

    ipcMain.handle('test-print', async (_event, { printerName: _printerName }) => {
         // Implement test print
         return { success: true };
    });
}
