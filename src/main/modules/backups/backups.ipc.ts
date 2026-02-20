import { ipcMain } from "electron";
import { BackupsService } from "@main/modules/backups/services/backups.service";

const backupsService = new BackupsService();

export function registerBackupsHandlers() {
    ipcMain.handle('backup:create', async (_event, type) => {
        return await backupsService.createBackup(type);
    });

    ipcMain.handle('backup:list', async () => {
        return await backupsService.listBackups();
    });

    ipcMain.handle('backup:restore', async (_event, fileName) => {
        return await backupsService.restoreBackup(fileName);
    });

    ipcMain.handle('backup:delete', async (_event, fileName) => {
        return await backupsService.deleteBackup(fileName);
    });
}
