import { ipcMain } from "electron";
import { ShiftsService } from "@main/modules/shifts/services/shifts.service";
import { requireAuth, requirePermission, hasPermission } from "@main/shared/session";

const shiftsService = new ShiftsService();

export function registerShiftsHandlers() {
    // Any authenticated user can query THEIR OWN active shift.
    // The identity always comes from the session — never from the payload.
    ipcMain.handle('shifts:getActive', async () => {
        try {
            const session = requireAuth();
            const shift = await shiftsService.getActiveShift(session.id);
            return { success: true, data: shift };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    /**
     * The session user's most recent CLOSED shift — the open-shift dialog uses
     * its final cash as the suggested opening float. Only safe summary fields
     * are returned.
     */
    ipcMain.handle('shifts:getLastClosed', async () => {
        try {
            const session = requireAuth();
            const shift = await shiftsService.getLastClosedShift(session.id);
            if (!shift) return { success: true, data: null };
            return {
                success: true,
                data: {
                    id: shift.id,
                    end_time: shift.end_time,
                    initial_cash: shift.initial_cash,
                    final_cash: shift.final_cash,
                    expected_cash: shift.expected_cash,
                    difference: shift.difference,
                },
            };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    // Guarded by pos:open_shift permission — opens a shift for the session user
    ipcMain.handle('shifts:open', async (_event, { initialCash }) => {
        try {
            const session = requirePermission('pos:open_shift');
            const shift = await shiftsService.createShift(session.id, initialCash);
            return { success: true, data: shift };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    // Guarded by pos:close_shift permission — only the shift owner can close it
    ipcMain.handle('shifts:close', async (_event, { shiftId, finalCash }) => {
        try {
            const session = requirePermission('pos:close_shift');
            const shift = await shiftsService.closeShift(shiftId, finalCash, session.id);
            return { success: true, message: 'Shift closed successfully', data: shift };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('shifts:getSales', async (_event, { shiftId }) => {
        try {
            const session = requireAuth();
            await shiftsService.assertShiftAccess(shiftId, session.id, hasPermission('shifts:view_others'));
            const sales = await shiftsService.getShiftSales(shiftId);
            return { success: true, data: sales };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    // Full history: users with shifts:view_others (or legacy admins) see all,
    // everyone else sees only their own shifts — filtered by the SESSION id.
    ipcMain.handle('history:get', async () => {
        try {
            const session = requireAuth();
            const canViewOthers = hasPermission('shifts:view_others');
            const shifts = await shiftsService.getShiftsHistory(canViewOthers ? undefined : session.id);
            return { success: true, data: shifts };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    // Debt payments for a given shift (for close-shift summary)
    ipcMain.handle('shifts:getDebtPayments', async (_event, { shiftId }) => {
        try {
            const session = requireAuth();
            await shiftsService.assertShiftAccess(shiftId, session.id, hasPermission('shifts:view_others'));
            const payments = await shiftsService.getDebtPayments(shiftId);
            return { success: true, data: payments };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('shifts:getExpenses', async (_event, { shiftId }) => {
        try {
            const session = requireAuth();
            await shiftsService.assertShiftAccess(shiftId, session.id, hasPermission('shifts:view_others'));
            const shift = await shiftsService.getShiftWithExpenses(shiftId);
            return { success: true, data: shift?.expenses || [] };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('shifts:add-expense', async (_event, { shiftId, amount, reason }) => {
        try {
            const session = requirePermission('shifts:manage_expenses');
            const expense = await shiftsService.addExpense(shiftId, amount, reason, session.id);
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
