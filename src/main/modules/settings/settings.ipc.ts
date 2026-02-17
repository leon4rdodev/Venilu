import { ipcMain } from "electron";
import { SettingsService } from "@main/modules/settings/services/settings.service";

const settingsService = new SettingsService();

export function registerSettingsHandlers() {
    ipcMain.handle('settings:get', async () => {
        try {
            const settings = await settingsService.get();
            return { success: true, settings };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('settings:update', async (_event, settingsData) => {
        try {
            await settingsService.update(settingsData);
            return { success: true, message: 'Settings updated successfully' };
        } catch (error: any) {
             return { success: false, message: error.message };
        }
    });
}
