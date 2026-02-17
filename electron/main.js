const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = process.env.NODE_ENV === 'development';
const { initializeDatabase, createShift, getActiveShift, closeShift, verifyUser, getUsers, createUser, updateUser, deleteUser, getProducts, getProductsForPOS, createProduct, updateProduct, deleteProduct, getLowStockProducts, getInventoryStats, getShiftsWithDetails, getSettings, updateSettings, createProductIndices, getCategories, createCategory, updateCategory, deleteCategory, getCategoriesWithCount, checkOnboardingStatus } = require('./db/index');
const { processSale, getSales, getSaleItems, getRecentSales, getSalesByShiftId } = require('./db/sales');
const { getTotalSalesMetrics, getSalesOverTime, getTopSellingProducts, getLeastSellingProducts, getDashboardStats, createReportsIndices } = require('./db/reports');

const { createBackup, listBackups, restoreBackup, deleteBackup, exportBackup, cleanOldBackups, getBackupInfo, checkAutoBackupNeeded, syncMasterBackup } = require('./db/backups');

let loggedInUser = null;

const viteDevServerUrl = 'http://localhost:5173';

async function loadViteDevServer(mainWindow) {
  try {
    await mainWindow.loadURL(viteDevServerUrl);
  } catch (error) {
    console.log('Vite server not ready, retrying...');
    setTimeout(() => loadViteDevServer(mainWindow), 200);
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1300,
    height: 800,
    resizable: true,
    useContentSize: true,
    icon: path.join(__dirname, isDev ? '../public/assets/venilu.ico' : '../dist/assets/venilu.ico'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.maximize();
  });

  if (isDev) {
    loadViteDevServer(mainWindow);
  } else {
    // Production: load from dist folder
    // Use app.getAppPath() to get correct path in packaged app
    const appPath = app.getAppPath();
    const indexPath = path.join(appPath, 'dist', 'index.html');

    console.log('=== Production Mode ===');
    console.log('App Path:', appPath);
    console.log('Index Path:', indexPath);
    console.log('File exists:', fs.existsSync(indexPath));
    console.log('__dirname:', __dirname);

    // Verify file exists before loading
    if (!fs.existsSync(indexPath)) {
      console.error('index.html not found at:', indexPath);
      console.log('Trying alternative path...');

      // Alternative path for some Windows builds
      const altPath = path.join(__dirname, '..', 'dist', 'index.html');
      console.log('Alternative path:', altPath);
      console.log('Alt file exists:', fs.existsSync(altPath));

      if (fs.existsSync(altPath)) {
        mainWindow.loadFile(altPath).catch(err => {
          console.error('Failed to load from alternative path:', err);
          const { dialog } = require('electron');
          dialog.showErrorBox('Load Error', `Failed to load app: ${err.message}\nPath: ${altPath}`);
        });
        return;
      }
    }

    mainWindow.loadFile(indexPath).catch(err => {
      console.error('Failed to load index.html:', err);
      // Show error dialog with detailed info
      const { dialog } = require('electron');
      dialog.showErrorBox(
        'Load Error',
        `Failed to load app: ${err.message}\n\nPath: ${indexPath}\nExists: ${fs.existsSync(indexPath)}\nApp Path: ${appPath}`
      );
    });
  }
}

app.whenReady().then(async () => {
  try {
    const dbPath = app.getPath('userData');
    await initializeDatabase(dbPath);
    await createProductIndices();
    await createReportsIndices();
    console.log('Electron app initialized successfully.');

    // Check if daily auto-backup is needed
    const autoBackupCheck = await checkAutoBackupNeeded();
    if (autoBackupCheck.success && autoBackupCheck.backupNeeded) {
      console.log('Creating daily auto-backup...');
      await createBackup('auto');
    }

    // Clean old backups (older than 30 days)
    await cleanOldBackups(30);

    // Sync master backup on startup and every 10 minutes
    await syncMasterBackup();
    setInterval(() => {
      syncMasterBackup().catch(err => console.error('Periodic master backup failed:', err));
    }, 10 * 60 * 1000); // 10 minutes
  } catch (error) {
    console.error('Failed to initialize database or create indices:', error);
  }

  try {
    // Register all IPC handlers after the database is ready
    ipcMain.handle('login-request', async (event, { username, password }) => {
      const result = await verifyUser(username, password);
      if (result.success) {
        loggedInUser = { id: result.id, role: result.role, name: result.name, username: result.username };
      }
      return result;
    });

    ipcMain.handle('get-users', async () => {
      return await getUsers();
    });

    ipcMain.handle('create-user', async (event, userData) => {
      // Allow creation during onboarding (when no admin exists yet)
      const onboardingStatus = await checkOnboardingStatus();
      const isOnboarding = onboardingStatus.success && !onboardingStatus.completed;

      // Check authorization: must be admin OR during onboarding
      if (!isOnboarding && (!loggedInUser || loggedInUser.role !== 'admin')) {
        return { success: false, message: 'Unauthorized' };
      }

      return await createUser(userData);
    });

    ipcMain.handle('update-user', async (event, { userId, userData }) => {
      if (!loggedInUser || loggedInUser.role !== 'admin') {
        return { success: false, message: 'Unauthorized' };
      }
      return await updateUser(userId, userData);
    });

    ipcMain.handle('delete-user', async (event, userId) => {
      if (!loggedInUser || loggedInUser.role !== 'admin') {
        return { success: false, message: 'Unauthorized' };
      }
      return await deleteUser(userId);
    });

    ipcMain.handle('get-products', async (event, options) => {
      return await getProducts(options || {});
    });

    ipcMain.handle('get-products-for-pos', async (event, options) => {
      return await getProductsForPOS(options || {});
    });

    ipcMain.handle('create-product', async (event, productData) => {
      return await createProduct(productData);
    });

    ipcMain.handle('update-product', async (event, { productId, productData }) => {
      return await updateProduct(productId, productData);
    });

    ipcMain.handle('delete-product', async (event, productId) => {
      return await deleteProduct(productId);
    });

    ipcMain.handle('get-low-stock-products', async (event, limit) => {
      return await getLowStockProducts(limit);
    });

    ipcMain.handle('get-inventory-stats', async () => {
      return await getInventoryStats();
    });

    ipcMain.handle('process-sale', async (event, { saleData, saleItems }) => {
      if (!loggedInUser) {
        return { success: false, message: 'No user logged in.' };
      }
      if (!saleData.shift_id) {
        return { success: false, message: 'No active shift for this sale.' };
      }
      const saleDataWithUser = { ...saleData, user_id: loggedInUser.id };
      return await processSale(saleDataWithUser, saleItems);
    });

    ipcMain.handle('get-sales', async () => {
      return await getSales();
    });

    ipcMain.handle('get-sale-items', async (event, saleId) => {
      return await getSaleItems(saleId);
    });

    ipcMain.handle('get-recent-sales', async (event, limit) => {
      return await getRecentSales(limit);
    });

    ipcMain.handle('get-total-sales-metrics', async (event, { startDate, endDate }) => {
      return await getTotalSalesMetrics(startDate ? new Date(startDate) : null, endDate ? new Date(endDate) : null);
    });

    ipcMain.handle('get-sales-over-time', async (event, { startDate, endDate, interval }) => {
      return await getSalesOverTime(startDate ? new Date(startDate) : null, endDate ? new Date(endDate) : null, interval);
    });

    ipcMain.handle('get-top-selling-products', async (event, { startDate, endDate, limit }) => {
      return await getTopSellingProducts(startDate ? new Date(startDate) : null, endDate ? new Date(endDate) : null, limit);
    });

    ipcMain.handle('get-least-selling-products', async (event, { startDate, endDate, limit }) => {
      return await getLeastSellingProducts(startDate ? new Date(startDate) : null, endDate ? new Date(endDate) : null, limit);
    });

    ipcMain.handle('get-dashboard-stats', async () => {
      return await getDashboardStats();
    });

    // Clear reports cache to force fresh data
    ipcMain.handle('clear-reports-cache', async () => {
      const { reportsCache } = require('./db/reports');
      reportsCache.clear();
      return { success: true };
    });

    // Generate PDF report handler
    ipcMain.handle('generate-sales-report-pdf', async (event, { startDate, endDate, metrics, salesOverTime, topSellingProducts, leastSellingProducts }) => {
      try {
        const win = BrowserWindow.getAllWindows()[0];
        if (!win) {
          return { success: false, message: 'No window available' };
        }

        // Get business settings for company info
        const settingsResult = await getSettings();
        const settings = settingsResult.success ? settingsResult.settings : {};

        // Format dates
        const formatDate = (dateStr) => {
          if (!dateStr) return 'N/A';
          const date = new Date(dateStr);
          return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
        };

        const formatCurrency = (amount) => {
          return new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(amount || 0);
        };

        // Generate HTML report
        const reportHTML = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <style>
                body {
                  font-family: Arial, sans-serif;
                  max-width: 210mm;
                  margin: 0 auto;
                  padding: 20mm;
                  font-size: 12px;
                  color: #333;
                }
                .header {
                  text-align: center;
                  margin-bottom: 30px;
                  border-bottom: 2px solid #333;
                  padding-bottom: 20px;
                }
                .header h1 {
                  margin: 0;
                  font-size: 24px;
                  color: #000;
                }
                .header .subtitle {
                  margin-top: 5px;
                  color: #666;
                }
                .info-section {
                  margin: 20px 0;
                }
                .info-section h2 {
                  font-size: 16px;
                  border-bottom: 1px solid #ddd;
                  padding-bottom: 5px;
                  margin-bottom: 15px;
                }
                .metrics-grid {
                  display: grid;
                  grid-template-columns: repeat(2, 1fr);
                  gap: 15px;
                  margin: 20px 0;
                }
                .metric-card {
                  border: 1px solid #ddd;
                  padding: 15px;
                  border-radius: 4px;
                }
                .metric-card .label {
                  font-size: 11px;
                  color: #666;
                  margin-bottom: 5px;
                }
                .metric-card .value {
                  font-size: 20px;
                  font-weight: bold;
                  color: #000;
                }
                .metric-card .change {
                  font-size: 10px;
                  margin-top: 5px;
                }
                .metric-card .change.up {
                  color: #10b981;
                }
                .metric-card .change.down {
                  color: #ef4444;
                }
                table {
                  width: 100%;
                  border-collapse: collapse;
                  margin: 15px 0;
                }
                th, td {
                  padding: 10px;
                  text-align: left;
                  border-bottom: 1px solid #ddd;
                }
                th {
                  background-color: #f3f4f6;
                  font-weight: bold;
                }
                .text-right {
                  text-align: right;
                }
                .footer {
                  margin-top: 40px;
                  padding-top: 20px;
                  border-top: 1px solid #ddd;
                  text-align: center;
                  font-size: 10px;
                  color: #666;
                }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>${settings.business_name || 'Reporte de Ventas'}</h1>
                <div class="subtitle">Reporte Detallado de Ventas</div>
                <div class="subtitle">Período: ${formatDate(startDate)} - ${formatDate(endDate)}</div>
              </div>

              <div class="info-section">
                <h2>Métricas Principales</h2>
                <div class="metrics-grid">
                  ${metrics && metrics.current ? `
                    <div class="metric-card">
                      <div class="label">Total Ventas</div>
                      <div class="value">${formatCurrency(metrics.current.totalAmount)}</div>
                      ${metrics.previous ? `<div class="change ${metrics.current.totalAmount >= metrics.previous.totalAmount ? 'up' : 'down'}">
                        ${metrics.current.totalAmount >= metrics.previous.totalAmount ? '↑' : '↓'} vs período anterior
                      </div>` : ''}
                    </div>
                    <div class="metric-card">
                      <div class="label">Ganancia Neta</div>
                      <div class="value">${formatCurrency(metrics.current.netProfit)}</div>
                      ${metrics.previous ? `<div class="change ${metrics.current.netProfit >= metrics.previous.netProfit ? 'up' : 'down'}">
                        ${metrics.current.netProfit >= metrics.previous.netProfit ? '↑' : '↓'} vs período anterior
                      </div>` : ''}
                    </div>
                    <div class="metric-card">
                      <div class="label">Costo Total</div>
                      <div class="value">${formatCurrency(metrics.current.totalCost)}</div>
                    </div>
                    <div class="metric-card">
                      <div class="label">Margen Promedio</div>
                      <div class="value">${metrics.current.averageMargin?.toFixed(1)}%</div>
                    </div>
                  ` : '<p>No hay datos disponibles</p>'}
                </div>
              </div>

              ${topSellingProducts && topSellingProducts.length > 0 ? `
                <div class="info-section">
                  <h2>Productos Más Vendidos</h2>
                  <table>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th class="text-right">Cantidad Vendida</th>
                        <th class="text-right">Ingresos Totales</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${topSellingProducts.map(product => `
                        <tr>
                          <td>${product.productName}</td>
                          <td class="text-right">${product.totalSold}</td>
                          <td class="text-right">${formatCurrency(product.totalRevenue)}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : ''}

              ${leastSellingProducts && leastSellingProducts.length > 0 ? `
                <div class="info-section">
                  <h2>Productos Menos Vendidos</h2>
                  <table>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th class="text-right">Cantidad Vendida</th>
                        <th class="text-right">Ingresos Totales</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${leastSellingProducts.map(product => `
                        <tr>
                          <td>${product.productName}</td>
                          <td class="text-right">${product.totalSold}</td>
                          <td class="text-right">${formatCurrency(product.totalRevenue)}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              ` : ''}

              <div class="footer">
                ${settings.business_name ? `<p>${settings.business_name}</p>` : ''}
                ${settings.rnc ? `<p>RNC: ${settings.rnc}</p>` : ''}
                ${settings.phone ? `<p>Tel: ${settings.phone}</p>` : ''}
                <p>Generado el ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES')}</p>
              </div>
            </body>
          </html>
        `;

        // Create a hidden window for printing to PDF
        const printWindow = new BrowserWindow({
          show: false,
          webPreferences: {
            nodeIntegration: false
          }
        });

        await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(reportHTML)}`);

        // Generate filename with date range
        const startDateStr = startDate ? new Date(startDate).toLocaleDateString('es-ES').replace(/\//g, '-') : 'inicio';
        const endDateStr = endDate ? new Date(endDate).toLocaleDateString('es-ES').replace(/\//g, '-') : 'fin';
        const fileName = `Reporte_Ventas_${startDateStr}_a_${endDateStr}.pdf`;

        // Use Downloads folder
        const downloadsPath = app.getPath('downloads');
        const filePath = path.join(downloadsPath, fileName);

        // Print to PDF
        const data = await printWindow.webContents.printToPDF({
          marginsType: 0,
          printBackground: true,
          printSelectionOnly: false,
          landscape: false
        });

        fs.writeFileSync(filePath, data);
        printWindow.close();

        return { success: true, filePath, message: 'PDF generado exitosamente' };
      } catch (error) {
        console.error('Error generating PDF report:', error);
        return { success: false, message: error.message };
      }
    });

    ipcMain.handle('shifts:open', async (event, { initialCash, user }) => {
      if (!user) {
        return { success: false, message: 'No user provided.' };
      }
      loggedInUser = user;
      return await createShift({ initialCash, userId: user.id });
    });

    ipcMain.handle('logout', async () => {
      loggedInUser = null;
      return { success: true };
    });

    ipcMain.handle('set-logged-in-user', async (event, userData) => {
      // This handler allows the frontend to restore the backend session
      // when the user is already logged in (e.g., from localStorage)
      if (userData && userData.id && userData.role) {
        loggedInUser = {
          id: userData.id,
          role: userData.role,
          name: userData.name,
          username: userData.username
        };
        console.log('Backend session restored for user:', loggedInUser.username);
        return { success: true };
      }
      return { success: false, message: 'Invalid user data' };
    });

    ipcMain.handle('shifts:getActive', async (event, { userId }) => {
      if (!userId) {
        return { success: false, shift: null };
      }
      return await getActiveShift(userId);
    });

    ipcMain.handle('shifts:close', async (event, { shiftId, finalCash }) => {
      return await closeShift({ shiftId, finalCash });
    });

    ipcMain.handle('shifts:getSales', async (event, { shiftId }) => {
      return await getSalesByShiftId(shiftId);
    });

    ipcMain.handle('history:get', async (event, { user }) => {
      if (!user) {
        return { success: false, message: 'No user provided.', shifts: [] };
      }
      return await getShiftsWithDetails(user);
    });

    // Settings IPC handlers
    ipcMain.handle('settings:get', async () => {
      return await getSettings();
    });

    ipcMain.handle('settings:update', async (event, settingsData) => {
      return await updateSettings(settingsData);
    });

    // Category IPC handlers
    ipcMain.handle('get-categories', async () => {
      return await getCategories();
    });

    ipcMain.handle('get-categories-with-count', async () => {
      return await getCategoriesWithCount();
    });

    ipcMain.handle('create-category', async (event, name) => {
      return await createCategory(name);
    });

    ipcMain.handle('update-category', async (event, { id, name }) => {
      return await updateCategory(id, name);
    });

    ipcMain.handle('delete-category', async (event, id) => {
      return await deleteCategory(id);
    });

    // Onboarding IPC handlers
    ipcMain.handle('onboarding:check', async () => {
      return await checkOnboardingStatus();
    });

    // Backup IPC handlers
    ipcMain.handle('backup:create', async (event, type = 'manual') => {
      return await createBackup(type);
    });

    ipcMain.handle('backup:list', async () => {
      return await listBackups();
    });

    ipcMain.handle('backup:restore', async (event, fileName) => {
      return await restoreBackup(fileName);
    });

    ipcMain.handle('backup:delete', async (event, fileName) => {
      return await deleteBackup(fileName);
    });

    ipcMain.handle('backup:export', async (event, { fileName, destinationPath }) => {
      return await exportBackup(fileName, destinationPath);
    });

    ipcMain.handle('backup:getInfo', async (event, fileName) => {
      return await getBackupInfo(fileName);
    });

    ipcMain.handle('backup:cleanOld', async (event, retentionDays = 30) => {
      return await cleanOldBackups(retentionDays);
    });

    // Dialog for selecting backup export location
    ipcMain.handle('dialog:selectBackupLocation', async (event, defaultFileName) => {
      const { dialog } = require('electron');
      const result = await dialog.showSaveDialog({
        title: 'Guardar Copia de Seguridad',
        defaultPath: defaultFileName,
        filters: [
          { name: 'SQLite Database', extensions: ['sqlite'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled) {
        return { success: false, message: 'Export cancelled' };
      }

      return { success: true, filePath: result.filePath };
    });


    // Printer handlers (uses Electron built-in webContents.print)
    const ReceiptPrinter = require('./receipts');

    ipcMain.handle('get-printers', async () => {
      try {
        const printers = await ReceiptPrinter.getPrinters();
        return { success: true, printers };
      } catch (error) {
        console.error('Error getting printers:', error);
        return { success: false, message: error.message, printers: [] };
      }
    });

    ipcMain.handle('test-print', async (event, { printerName }) => {
      try {
        console.log('Testing print on:', printerName);
        return await ReceiptPrinter.testPrint(printerName);
      } catch (error) {
        console.error('Error testing print:', error);
        return { success: false, message: error.message };
      }
    });

    // Print receipt/ticket
    ipcMain.handle('print-receipt', async (event, { saleId }) => {
      try {
        return await ReceiptPrinter.printReceipt(saleId);
      } catch (error) {
        console.error('Error printing receipt:', error);
        return { success: false, message: "Error de impresión: " + error.message };
      }
    });

    // Logo file management
    ipcMain.handle('upload-logo', async (event, { fileName, fileData }) => {
      try {
        const logosDir = path.join(app.getPath('userData'), 'logos');

        // Create logos directory if it doesn't exist
        if (!fs.existsSync(logosDir)) {
          fs.mkdirSync(logosDir, { recursive: true });
        }

        // Validate file extension
        const ext = path.extname(fileName).toLowerCase();
        if (!['.png', '.jpg', '.jpeg'].includes(ext)) {
          return { success: false, message: 'Formato no válido. Use PNG o JPG.' };
        }

        // Generate unique filename
        const timestamp = Date.now();
        const newFileName = `logo_${timestamp}${ext}`;
        const filePath = path.join(logosDir, newFileName);

        // Decode base64 and save file
        const base64Data = fileData.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

        return { success: true, fileName: newFileName, message: 'Logo guardado exitosamente' };
      } catch (error) {
        console.error('Error uploading logo:', error);
        return { success: false, message: error.message };
      }
    });

    ipcMain.handle('get-logo', async (event, { fileName }) => {
      try {
        if (!fileName) {
          return { success: false, message: 'No logo file specified' };
        }

        const logosDir = path.join(app.getPath('userData'), 'logos');
        const filePath = path.join(logosDir, fileName);

        if (!fs.existsSync(filePath)) {
          return { success: false, message: 'Logo file not found' };
        }

        const fileData = fs.readFileSync(filePath);
        const ext = path.extname(fileName).toLowerCase();
        const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
        const base64Data = `data:${mimeType};base64,${fileData.toString('base64')}`;

        return { success: true, fileData: base64Data };
      } catch (error) {
        console.error('Error getting logo:', error);
        return { success: false, message: error.message };
      }
    });

    ipcMain.handle('delete-logo', async (event, { fileName }) => {
      try {
        if (!fileName) {
          return { success: false, message: 'No logo file specified' };
        }

        const logosDir = path.join(app.getPath('userData'), 'logos');
        const filePath = path.join(logosDir, fileName);

        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }

        return { success: true, message: 'Logo eliminado' };
      } catch (error) {
        console.error('Error deleting logo:', error);
        return { success: false, message: error.message };
      }
    });

    // Seed products handler - DISABLED FOR PRODUCTION
    // Uncomment only for development/testing purposes
    /*
    ipcMain.handle('seed-products', async () => {
      try {
        await seedProducts();
        return { success: true, message: '100 productos insertados exitosamente' };
      } catch (error) {
        console.error('Error seeding products:', error);
        return { success: false, message: error.message };
      }
    });
    */


    createWindow();

  } catch (err) {
    console.error('Failed to initialize application:', err);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
