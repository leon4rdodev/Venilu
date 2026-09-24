import { ipcMain, app, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { SettingsService } from '@main/modules/settings/services/settings.service';
import { UsersService } from '@main/modules/users/services/users.service';
import { requirePermission } from '@main/shared/session';
import { auditService } from '@main/modules/audit/services/audit.service';

const settingsService = new SettingsService();
const usersService = new UsersService();

/**
 * app.getVersion() devuelve la versión de Electron cuando la app corre sin
 * empaquetar (dev): en ese caso se lee package.json del proyecto.
 */
function getAppVersion(): string {
  if (app.isPackaged) return app.getVersion();
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../package.json'), 'utf8'));
    if (typeof pkg?.version === 'string') return pkg.version;
  } catch { /* fall through */ }
  return app.getVersion();
}

export function registerSettingsHandlers() {
  ipcMain.handle('settings:get', async () => {
    try {
      // settings:get is public — needed on the login page for business branding
      const settings = await settingsService.get();
      return { success: true, data: settings };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('settings:update', async (_event, settingsData) => {
    try {
      // Allow without auth during onboarding (first time setup)
      const onboarding = await usersService.checkOnboardingStatus();
      if (onboarding.completed) requirePermission('settings:edit');
      await settingsService.update(settingsData);
      if (onboarding.completed) {
        const fields = Object.keys(settingsData ?? {}).filter(k => k !== 'logo');
        auditService.log('settings:update', undefined, fields.join(', '), { fields });
      }
      return { success: true, message: 'Configuración actualizada.' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  /** App/runtime metadata for Ajustes → Acerca de. No sensitive data. */
  ipcMain.handle('app:info', async () => {
    try {
      return {
        success: true,
        data: {
          version: getAppVersion(),
          electron: process.versions.electron,
          chrome: process.versions.chrome,
          node: process.versions.node,
          platform: process.platform,
          arch: process.arch,
        },
      };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  /**
   * Aplica la escala de interfaz (zoom tipo navegador) a la ventana que envía
   * el mensaje. El valor viene validado por SettingsService al persistirse;
   * aquí solo se desconfía de tipos (número positivo).
   */
  ipcMain.handle('app:set-ui-scale', (event, scale) => {
    try {
      const factor = Number(scale);
      if (!Number.isFinite(factor) || factor <= 0) throw new Error('Escala inválida');
      const win = BrowserWindow.fromWebContents(event.sender);
      win?.webContents.setZoomFactor(factor);
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  // ─── Logo handlers ────────────────────────────────────────────────────────

  ipcMain.handle('upload-logo', async (_event, { fileName, fileData }: { fileName: string; fileData: string }) => {
    try {
      // Logo upload is allowed during onboarding (before first login)
      const onboarding = await usersService.checkOnboardingStatus();
      if (onboarding.completed) requirePermission('settings:logo');

      const base64Data = fileData.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');

      const ext = path.extname(fileName) || '.png';
      // Sanitize: only allow safe image extensions
      if (!['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext.toLowerCase())) {
        throw new Error('Formato de imagen no permitido.');
      }

      const uniqueFileName = `logo_${Date.now()}${ext}`;
      const filePath = path.join(app.getPath('userData'), uniqueFileName);
      fs.writeFileSync(filePath, buffer);

      return { success: true, fileName: uniqueFileName };
    } catch (err: any) {
      console.error('[settings.ipc] upload-logo:', err);
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('get-logo', async (_event, { fileName }: { fileName: string }) => {
    try {
      // Public endpoint — logo is shown on the login page (no sensitive data)
      if (!fileName) return { success: false, message: 'Nombre de archivo requerido.' };

      // Sanitize: resolve relative to userData and validate it stays inside
      const userDataDir = app.getPath('userData');
      const filePath = path.resolve(userDataDir, path.basename(fileName));
      if (!filePath.startsWith(userDataDir)) {
        throw new Error('Ruta de archivo no permitida.');
      }

      if (!fs.existsSync(filePath)) return { success: false, message: 'Logo no encontrado.' };

      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(fileName).substring(1) || 'png';
      const fileData = `data:image/${ext};base64,${buffer.toString('base64')}`;

      return { success: true, fileData };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('delete-logo', async (_event, { fileName }: { fileName: string }) => {
    try {
      requirePermission('settings:logo');
      if (!fileName) return { success: true };

      const userDataDir = app.getPath('userData');
      const filePath = path.resolve(userDataDir, path.basename(fileName));
      if (!filePath.startsWith(userDataDir)) {
        throw new Error('Ruta de archivo no permitida.');
      }

      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });
}
