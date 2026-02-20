import { ipcMain } from "electron";
import { SettingsService } from "@main/modules/settings/services/settings.service";
import { requireRole, requireAuth } from "@main/shared/session";

const settingsService = new SettingsService();

export function registerSettingsHandlers() {
    // Any authenticated user can read settings
    ipcMain.handle('settings:get', async () => {
        try {
            requireAuth();
            const settings = await settingsService.get();
            return { success: true, settings };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    // Admin only
    ipcMain.handle('settings:update', async (_event, settingsData) => {
        try {
            requireRole('admin');
            await settingsService.update(settingsData);
            return { success: true, message: 'Settings updated successfully' };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });
}
