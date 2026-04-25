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

    // Logo handlers
    ipcMain.handle('upload-logo', async (_event, { fileName, fileData }: { fileName: string; fileData: string }) => {
        try {
            const fs = require('fs');
            const path = require('path');
            const { app } = require('electron');
            
            // Extract base64 data (remove "data:image/png;base64," prefix)
            const base64Data = fileData.replace(/^data:image\/\w+;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');
            
            // Generate a unique filename to avoid caching issues
            const ext = path.extname(fileName) || '.png';
            const uniqueFileName = `logo_${Date.now()}${ext}`;
            const filePath = path.join(app.getPath('userData'), uniqueFileName);
            
            fs.writeFileSync(filePath, buffer);
            
            return { success: true, fileName: uniqueFileName, message: 'Logo uploaded' };
        } catch (error: any) {
            console.error('Error uploading logo:', error);
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('get-logo', async (_event, { fileName }: { fileName: string }) => {
        try {
            const fs = require('fs');
            const path = require('path');
            const { app } = require('electron');
            
            if (!fileName) return { success: false, message: 'No filename provided' };
            
            const filePath = path.join(app.getPath('userData'), fileName);
            if (!fs.existsSync(filePath)) {
                return { success: false, message: 'Logo not found' };
            }
            
            const buffer = fs.readFileSync(filePath);
            const ext = path.extname(fileName).substring(1) || 'png';
            const fileData = `data:image/${ext};base64,${buffer.toString('base64')}`;
            
            return { success: true, fileData };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });

    ipcMain.handle('delete-logo', async (_event, { fileName }: { fileName: string }) => {
        try {
            const fs = require('fs');
            const path = require('path');
            const { app } = require('electron');
            
            if (!fileName) return { success: true }; // Nothing to delete
            
            const filePath = path.join(app.getPath('userData'), fileName);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            
            return { success: true, message: 'Logo deleted' };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    });
}
