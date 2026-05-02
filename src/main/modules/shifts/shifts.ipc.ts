import { ipcMain } from "electron";
import { ShiftsService } from "@main/modules/shifts/services/shifts.service";
import { requireAuth, requirePermission, getSessionUser } from "@main/shared/session";

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

    // Guarded by pos:open_shift permission
    ipcMain.handle('shifts:open', async (_event, { initialCash, user }) => {
        try {
            requirePermission('pos:open_shift');
            const shift = await shiftsService.createShift(user.id, initialCash);
            return { success: true, data: shift };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    // Guarded by pos:close_shift permission
    ipcMain.handle('shifts:close', async (_event, { shiftId, finalCash }) => {
        try {
            requirePermission('pos:close_shift');
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

    // Full history: admin/supervisor sees all, employee sees their own
    ipcMain.handle('history:get', async (_event, { user }) => {
        try {
            requireAuth();
            const session = getSessionUser();
            const hasPermission = session?.permissions.includes('shifts:view_others');
            const isAdmin = session?.role === 'admin';
            
            const shifts = await shiftsService.getShiftsHistory((isAdmin || hasPermission) ? undefined : user.id);
            return { success: true, data: shifts };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    // Debt payments for a given shift (for close-shift summary)
    ipcMain.handle('shifts:getDebtPayments', async (_event, { shiftId }) => {
        try {
            requireAuth();
            const payments = await shiftsService.getDebtPayments(shiftId);
            return { success: true, data: payments };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('shifts:getExpenses', async (_event, { shiftId }) => {
        try {
            requireAuth();
            const shift = await shiftsService.getShiftWithExpenses(shiftId);
            return { success: true, data: shift?.expenses || [] };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('shifts:add-expense', async (_event, { shiftId, amount, reason }) => {
        try {
            requirePermission('shifts:manage_expenses');
            const expense = await shiftsService.addExpense(shiftId, amount, reason);
            return { success: true, data: expense };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    // Admin force-close any open shift
    ipcMain.handle('shifts:forceClose', async (_event, { shiftId, finalCash, reason }) => {
        try {
            const admin = requirePermission('shifts:force_close');
            const shift = await shiftsService.forceClose(shiftId, finalCash, admin.id, reason);
            return { success: true, data: shift };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });
}
