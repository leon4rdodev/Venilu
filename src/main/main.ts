import { app, BrowserWindow } from 'electron';
import path from 'path';
import { AppDataSource } from '@main/config/data-source';
import { RolesService } from '@main/modules/users/services/roles.service';
import { registerUsersHandlers } from '@main/modules/users/users.ipc';
import { registerProductsHandlers } from '@main/modules/products/products.ipc';
import { registerCategoriesHandlers } from '@main/modules/categories/categories.ipc';
import { registerSalesHandlers } from '@main/modules/sales/sales.ipc';
import { registerShiftsHandlers } from '@main/modules/shifts/shifts.ipc';
import { registerSettingsHandlers } from '@main/modules/settings/settings.ipc';
import { registerReportsHandlers } from '@main/modules/reports/reports.ipc';
import { registerBackupsHandlers } from '@main/modules/backups/backups.ipc';
import { registerCustomersHandlers } from '@main/modules/customers/customers.ipc';
import { registerPrinterHandlers } from '@main/shared/ipc/printer.ipc';
import { registerSessionHandlers } from '@main/shared/session';
import { setupAutoUpdater } from '@main/shared/ipc/updater.ipc';

const isDev = process.env.NODE_ENV === 'development';

async function createWindow() {
    const preloadPath = isDev
        ? path.join(__dirname, '../../dist-electron/preload.js')
        : path.join(__dirname, '../preload.js');

    const mainWindow = new BrowserWindow({
        width: 1300,
        height: 800,
        show: false,
        backgroundColor: '#ffffff',
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: preloadPath,
        },
    });

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
    }

    setupAutoUpdater(mainWindow);
    return mainWindow;
}

async function initialize() {
    try {
        // 1. Initialize DB and synchronize schema (creates new tables/columns)
        await AppDataSource.initialize();
        console.log('[App] Database initialized.');

        // 2. Seed system roles (idempotent — safe to run on every boot)
        const rolesService = new RolesService();
        await rolesService.seedSystemRoles();

        // 3. Assign role_id to existing users who don't have one yet
        await rolesService.migrateExistingUsers();

        // 4. Register IPC handlers — must happen after DB is ready
        registerSessionHandlers(); // first — establishes auth context
        registerUsersHandlers();
        registerProductsHandlers();
        registerCategoriesHandlers();
        registerSalesHandlers();
        registerShiftsHandlers();
        registerSettingsHandlers();
        registerReportsHandlers();
        registerBackupsHandlers();
        registerCustomersHandlers();
        registerPrinterHandlers();

        // 5. Create the browser window
        createWindow();
    } catch (err) {
        console.error('[App] Initialization error:', err);
        app.quit();
    }
}

app.whenReady().then(initialize);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
