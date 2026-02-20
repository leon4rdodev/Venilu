import { app, BrowserWindow } from 'electron';
import path from 'path';
import { AppDataSource } from '@main/config/data-source';
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

// Determine if we are in development mode
const isDev = process.env.NODE_ENV === 'development';

async function createWindow() {
    // In dev mode, __dirname is src/main/ so we resolve from project root
    // In production, __dirname is dist-electron/main/ so ../preload.js works
    const preloadPath = isDev
        ? path.join(__dirname, '../../dist-electron/preload.js')
        : path.join(__dirname, '../preload.js');

    const mainWindow = new BrowserWindow({
        width: 1300,
        height: 800,
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: preloadPath,
        },
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        // mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
    }
}

async function initialize() {
    try {
        await AppDataSource.initialize();
        console.log('Data Source has been initialized!');

        // Register IPC Handlers
        registerSessionHandlers(); // must be first — sets up session/auth context
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

        createWindow();
    } catch (err) {
        console.error('Error during initialization:', err);
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
