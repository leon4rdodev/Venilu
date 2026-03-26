import { ipcMain } from "electron";
import { SettingsService } from "@main/modules/settings/services/settings.service";
import { UsersService } from "@main/modules/users/services/users.service";
import { requireRole, requireAuth } from "@main/shared/session";

const settingsService = new SettingsService();
const usersService = new UsersService();

export function registerSettingsHandlers() {
    // Any authenticated user can read settings
    ipcMain.handle('settings:get', async () => {
        try {
            requireAuth();
            const settings = await settingsService.get();
            return { success: true, data: settings };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    // Admin only (or during onboarding)
    ipcMain.handle('settings:update', async (_event, settingsData) => {
        try {
            const onboarding = await usersService.checkOnboardingStatus();
            if (onboarding.completed) {
                requireRole('admin');
            }
            await settingsService.update(settingsData);
            return { success: true, message: 'Settings updated successfully' };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });
}
