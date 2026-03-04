import { ipcMain, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';

/**
 * Configures and registers auto-updater IPC handlers.
 * Call this once after the main BrowserWindow is created.
 */
export function setupAutoUpdater(mainWindow: BrowserWindow) {
  // ─── Updater config ────────────────────────────────────────────────────────
  autoUpdater.autoDownload = true;       // download in background automatically
  autoUpdater.autoInstallOnAppQuit = true; // install when the user closes the app

  // ─── Updater events → IPC → Renderer ──────────────────────────────────────
  autoUpdater.on('checking-for-update', () => {
    mainWindow.webContents.send('updater:checking');
  });

  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('updater:update-available', {
      version: info.version,
      releaseNotes: info.releaseNotes ?? null,
    });
  });

  autoUpdater.on('update-not-available', () => {
    mainWindow.webContents.send('updater:up-to-date');
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow.webContents.send('updater:download-progress', {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow.webContents.send('updater:update-downloaded', {
      version: info.version,
    });
  });

  autoUpdater.on('error', (err) => {
    mainWindow.webContents.send('updater:error', err.message);
  });

  // ─── IPC: renderer asks to restart & install ───────────────────────────────
  ipcMain.handle('updater:install-now', () => {
    autoUpdater.quitAndInstall();
  });

  // ─── Check for updates (only in production) ───────────────────────────────
  if (process.env.NODE_ENV !== 'development') {
    // Delay slightly so the window is fully loaded before checking
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        console.error('[updater] checkForUpdates error:', err);
      });
    }, 3000);
  }
}
