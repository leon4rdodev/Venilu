import { ipcMain } from "electron";
import { ShiftsService } from "@main/modules/shifts/services/shifts.service";

const shiftsService = new ShiftsService();

export function registerShiftsHandlers() {
    ipcMain.handle('shifts:getActive', async (_event, { userId }) => {
        try {
            const shift = await shiftsService.getActiveShift(userId);
            return { success: true, shift };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('shifts:open', async (_event, { initialCash, user }) => {
        try {
            const shift = await shiftsService.createShift(user.id, initialCash);
            return { success: true, shift };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('shifts:close', async (_event, { shiftId, finalCash }) => {
        try {
            const shift = await shiftsService.closeShift(shiftId, finalCash);
            return { success: true, message: 'Shift closed successfully', shift };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('shifts:getSales', async (_event, { shiftId }) => {
        try {
            const sales = await shiftsService.getShiftSales(shiftId);
            return { success: true, sales };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('history:get', async (_event, { user }) => {
        try {
            const shifts = await shiftsService.getShiftsHistory(user.role === 'admin' ? undefined : user.id);
            return { success: true, shifts };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });
}
