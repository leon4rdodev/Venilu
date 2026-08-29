import { app, BrowserWindow, protocol, net } from 'electron';
import path from 'path';
import { pathToFileURL } from 'url';
import { imagesService, migrateLegacyProductImages } from '@main/shared/services/images.service';
import { AppDataSource } from '@main/config/data-source';
import { runMigrationsWithBaseline } from '@main/config/run-migrations';
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
import { registerAuditHandlers } from '@main/modules/audit/audit.ipc';
import { BackupsService } from '@main/modules/backups/services/backups.service';
import { registerSessionHandlers } from '@main/shared/session';
import { setupAutoUpdater } from '@main/shared/ipc/updater.ipc';

const isDev = process.env.NODE_ENV === 'development';

// Must run before app 'ready': allows the venilu:// scheme to be used for
// <img> tags (product images served straight from disk, never through the DB).
protocol.registerSchemesAsPrivileged([
    { scheme: 'venilu', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

/** Serves userData/product-images/<file> as venilu://product-images/<file>. */
function registerImageProtocol() {
    protocol.handle('venilu', (request) => {
        try {
            const url = new URL(request.url);
            if (url.host === 'product-images') {
                const fileName = path.basename(decodeURIComponent(url.pathname));
                const filePath = imagesService.resolveImagePath(fileName);
                if (filePath) return net.fetch(pathToFileURL(filePath).toString());
            }
        } catch (err) {
            console.error('[Protocol] venilu:// error:', err);
        }
        return new Response('Not found', { status: 404 });
    });
}

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

    return mainWindow;
}

async function initialize() {
    try {
        // 1. Initialize DB and synchronize schema (creates new tables/columns)
        await AppDataSource.initialize();
        console.log('[App] Database initialized.');

        // Schema via migrations (synchronize is off): fresh installs build the
        // full schema; pre-migration installs are baselined without touching them.
        await runMigrationsWithBaseline();

        // Performance: WAL journaling avoids writer-blocks-reader stalls and
        // makes commits much cheaper; NORMAL sync is safe with WAL.
        await AppDataSource.query('PRAGMA journal_mode = WAL');
        await AppDataSource.query('PRAGMA synchronous = NORMAL');
        // Concurrent IPC handlers can briefly contend for the writer lock even
        // under WAL — wait instead of surfacing SQLITE_BUSY to the user.
        await AppDataSource.query('PRAGMA busy_timeout = 3000');
        // Refresh planner statistics so the report/list indices are actually
        // chosen once tables grow (no-op when stats are already fresh).
        await AppDataSource.query('PRAGMA optimize');

        // 2. Seed system roles (idempotent — safe to run on every boot)
        const rolesService = new RolesService();
        await rolesService.seedSystemRoles();

        // 3. Assign role_id to existing users who don't have one yet
        await rolesService.migrateExistingUsers();

        // 3b. Move legacy base64 product images out of the DB into files
        await migrateLegacyProductImages();

        // 3c. Serve product images via venilu:// (filesystem, not IPC/DB)
        registerImageProtocol();

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
        registerAuditHandlers();

        // 5. Create the browser window and wire the auto-updater ONCE
        // (registering it per-window duplicated IPC handlers on macOS 'activate')
        const mainWindow = await createWindow();
        setupAutoUpdater(mainWindow);

        // 6. Scheduled automatic backup — deferred so it never delays first paint
        setTimeout(() => {
            new BackupsService().runAutoBackupIfDue();
        }, 10_000);
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
