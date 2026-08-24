import { ipcMain, dialog, app } from 'electron';
import fs from 'fs';
import path from 'path';
import { BackupsService } from '@main/modules/backups/services/backups.service';
import { requirePermission } from '@main/shared/session';
import { auditService } from '@main/modules/audit/services/audit.service';

const backupsService = new BackupsService();

/**
 * Export destinations approved via the native save dialog in THIS session.
 * backup:export refuses any destination the user did not pick in the dialog —
 * this prevents the renderer from writing to arbitrary paths.
 */
const approvedExportDestinations = new Set<string>();

export function registerBackupsHandlers() {
  ipcMain.handle('backup:create', async (_event, type) => {
    try {
      requirePermission('backups:manage');
      return await backupsService.createBackup(type);
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('backup:list', async () => {
    try {
      requirePermission('backups:manage');
      return await backupsService.listBackups();
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('backup:restore', async (_event, fileName) => {
    try {
      requirePermission('backups:manage');
      const result = await backupsService.restoreBackup(fileName);
      auditService.log('backup:restore', undefined, fileName);
      return result;
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('backup:delete', async (_event, fileName) => {
    try {
      requirePermission('backups:manage');
      const result = await backupsService.deleteBackup(fileName);
      auditService.log('backup:delete', undefined, fileName);
      return result;
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  /**
   * Opens a native Save dialog so the user can choose where to export the backup.
   * Returns the chosen file path or cancels gracefully.
   */
  ipcMain.handle('dialog:selectBackupLocation', async (_event, fileName: string) => {
    try {
      requirePermission('backups:manage');
      const rawResult = await (dialog.showSaveDialog as any)({
        title: 'Exportar copia de seguridad',
        defaultPath: fileName,
        filters: [{ name: 'SQLite Database', extensions: ['sqlite'] }],
      }) as { canceled: boolean; filePath?: string };

      if (rawResult.canceled || !rawResult.filePath) {
        return { success: false, canceled: true };
      }

      approvedExportDestinations.add(path.resolve(rawResult.filePath));
      return { success: true, filePath: rawResult.filePath };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  /**
   * Copies a backup file from userData/backups to the user-chosen destination.
   */
  ipcMain.handle('backup:export', async (_event, { fileName, destinationPath }: { fileName: string; destinationPath: string }) => {
    try {
      requirePermission('backups:manage');

      // Validate that the source file is inside the expected backups directory
      const backupsDir = path.join(app.getPath('userData'), 'backups');
      const sourcePath = path.resolve(backupsDir, path.basename(fileName));

      if (!sourcePath.startsWith(backupsDir)) {
        throw new Error('Ruta de origen no permitida.');
      }

      if (!fs.existsSync(sourcePath)) {
        throw new Error('El archivo de backup no existe.');
      }

      // Only allow destinations the user explicitly chose in the save dialog
      const resolvedDest = path.resolve(destinationPath);
      if (!approvedExportDestinations.has(resolvedDest)) {
        throw new Error('Destino no autorizado. Selecciona la ubicación con el diálogo de exportación.');
      }
      approvedExportDestinations.delete(resolvedDest);

      fs.copyFileSync(sourcePath, resolvedDest);

      auditService.log('backup:export', undefined, fileName, { destination: resolvedDest });
      return { success: true, message: 'Backup exportado correctamente.' };
    } catch (err: any) {
      console.error('[backups.ipc] backup:export:', err);
      return { success: false, message: err.message };
    }
  });
}
