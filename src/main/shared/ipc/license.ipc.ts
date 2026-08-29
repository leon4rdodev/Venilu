import { ipcMain } from 'electron';
import { licenseService } from '@main/shared/services/license.service';
import { auditService } from '@main/modules/audit/services/audit.service';

/**
 * Both channels are PUBLIC (no session): activation happens on the blocking
 * screen before anyone can log in.
 */
export function registerLicenseHandlers() {
  ipcMain.handle('license:status', async () => {
    try {
      const status = await licenseService.getStatus();
      return { success: true, data: status };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('license:activate', async (_event, { key } = {}) => {
    try {
      const status = await licenseService.activate(String(key ?? ''));
      auditService.log('license:activate', status.license?.id, status.license?.customer);
      return { success: true, data: status };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });
}
