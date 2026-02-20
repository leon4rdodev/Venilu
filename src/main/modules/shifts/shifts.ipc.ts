import { ipcMain } from "electron";
import { ShiftsService } from "@main/modules/shifts/services/shifts.service";
import { requireRole, requireAuth } from "@main/shared/session";

const shiftsService = new ShiftsService();

export function registerShiftsHandlers() {
    // Any authenticated user can query their own active shift
    ipcMain.handle('shifts:getActive', async (_event, { userId }) => {
        try {
            requireAuth();
            const shift = await shiftsService.getActiveShift(userId);
            return { success: true, data: shift };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    // Any authenticated user can open a shift
    ipcMain.handle('shifts:open', async (_event, { initialCash, user }) => {
        try {
            requireAuth();
            const shift = await shiftsService.createShift(user.id, initialCash);
            return { success: true, data: shift };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    // Any authenticated user can close their own shift
    ipcMain.handle('shifts:close', async (_event, { shiftId, finalCash }) => {
        try {
            requireAuth();
            const shift = await shiftsService.closeShift(shiftId, finalCash);
            return { success: true, message: 'Shift closed successfully', data: shift };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('shifts:getSales', async (_event, { shiftId }) => {
        try {
            requireAuth();
            const sales = await shiftsService.getShiftSales(shiftId);
            return { success: true, data: sales };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    // Full history: admin sees all, employee sees their own (enforced at query level)
    ipcMain.handle('history:get', async (_event, { user }) => {
        try {
            requireAuth();
            const shifts = await shiftsService.getShiftsHistory(user.role === 'admin' ? undefined : user.id);
            return { success: true, data: shifts };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });
}
