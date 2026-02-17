const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { runAsync, closeDatabase, initializeDatabase } = require('./connection');

/**
 * Get the path to the backups directory
 */
function getBackupsDir() {
  const backupsDir = path.join(app.getPath('userData'), 'backups');
  
  // Create backups directory if it doesn't exist
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }
  
  return backupsDir;
}

/**
 * Get the path to the current database file
 */
function getDatabasePath() {
  return path.join(app.getPath('userData'), 'database.sqlite');
}

/**
 * Create a backup of the database
 * @param {string} type - 'manual' or 'auto'
 * @returns {Promise<{success: boolean, message: string, fileName?: string, filePath?: string}>}
 */
async function createBackup(type = 'manual') {
  try {
    const dbPath = getDatabasePath();
    
    // Check if database exists
    if (!fs.existsSync(dbPath)) {
      return { success: false, message: 'Archivo de base de datos no encontrado' };
    }

    // Generate backup filename with timestamp
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/:/g, '-')
      .replace(/\./g, '-')
      .substring(0, 19); // YYYY-MM-DDTHH-MM-SS
    
    const fileName = `backup_${type}_${timestamp}.sqlite`;
    const backupsDir = getBackupsDir();
    const backupPath = path.join(backupsDir, fileName);

    // Use VACUUM INTO for an atomic, consistent backup.
    // This creates a perfect copy of the database even while it's open and in WAL mode.
    // It consolidates the WAL file into the backup, so the backup is a single clean .sqlite file.
    await runAsync(`VACUUM INTO ?`, [backupPath]);

    console.log(`Backup created via VACUUM INTO: ${fileName}`);

    return {
      success: true,
      message: 'Copia de seguridad creada exitosamente',
      fileName,
      filePath: backupPath
    };
  } catch (error) {
    console.error('Error creating backup:', error);
    return {
      success: false,
      message: `Error al crear la copia de seguridad: ${error.message}`
    };
  }
}

/**
 * List all available backups
 * @returns {Promise<{success: boolean, backups: Array, message?: string}>}
 */
async function listBackups() {
  try {
    const backupsDir = getBackupsDir();
    
    // Read all files in backups directory
    const files = fs.readdirSync(backupsDir);
    
    // Filter only .sqlite files and get their info
    const backups = files
      .filter(file => file.endsWith('.sqlite'))
      .map(fileName => {
        const filePath = path.join(backupsDir, fileName);
        const stats = fs.statSync(filePath);
        
        // Parse the filename to extract type and date
        // Format: backup_[type]_[timestamp].sqlite
        const parts = fileName.replace('.sqlite', '').split('_');
        const type = parts[1] || 'manual';
        
        return {
          fileName,
          filePath,
          size: stats.size,
          createdAt: stats.birthtime.toISOString(),
          type
        };
      })
      // Sort by creation date (newest first)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return {
      success: true,
      backups
    };
  } catch (error) {
    console.error('Error listing backups:', error);
    return {
      success: false,
      backups: [],
      message: error.message
    };
  }
}

/**
 * Restore database from a backup
 * @param {string} fileName - Name of the backup file to restore
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function restoreBackup(fileName) {
  try {
    const backupsDir = getBackupsDir();
    const backupPath = path.join(backupsDir, fileName);
    
    // Check if backup file exists
    if (!fs.existsSync(backupPath)) {
      return { success: false, message: 'Archivo de copia de seguridad no encontrado' };
    }

    // Create a safety backup of current database before restoring
    await createBackup('pre-restore');

    const dbPath = getDatabasePath();

    // Close the active database connection to release the file lock
    await closeDatabase();
    console.log('Database closed for restore.');

    // Replace current database file with the backup copy
    fs.copyFileSync(backupPath, dbPath);

    // Remove any leftover WAL/SHM files from the old database
    const walPath = dbPath + '-wal';
    const shmPath = dbPath + '-shm';
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

    console.log(`Database restored from: ${fileName}`);

    // Re-initialize the database connection with the restored file
    const userDataPath = app.getPath('userData');
    await initializeDatabase(userDataPath);
    console.log('Database re-initialized after restore.');

    return {
      success: true,
      message: 'Base de datos restaurada exitosamente.'
    };
  } catch (error) {
    console.error('Error restoring backup:', error);

    // Attempt to re-open the connection even on failure
    try {
      const userDataPath = app.getPath('userData');
      await initializeDatabase(userDataPath);
    } catch (reinitErr) {
      console.error('Failed to re-initialize database after restore failure:', reinitErr);
    }

    return {
      success: false,
      message: `Error al restaurar: ${error.message}`
    };
  }
}

/**
 * Delete a backup file
 * @param {string} fileName - Name of the backup file to delete
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function deleteBackup(fileName) {
  try {
    const backupsDir = getBackupsDir();
    const backupPath = path.join(backupsDir, fileName);
    
    // Check if backup file exists
    if (!fs.existsSync(backupPath)) {
      return { success: false, message: 'Backup file not found' };
    }

    // Delete the backup file
    fs.unlinkSync(backupPath);

    console.log(`Backup deleted: ${fileName}`);

    return {
      success: true,
      message: 'Backup deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting backup:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Export a backup to a custom location
 * @param {string} fileName - Name of the backup file to export
 * @param {string} destinationPath - Path where to export the backup
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function exportBackup(fileName, destinationPath) {
  try {
    const backupsDir = getBackupsDir();
    const backupPath = path.join(backupsDir, fileName);
    
    // Check if backup file exists
    if (!fs.existsSync(backupPath)) {
      return { success: false, message: 'Backup file not found' };
    }

    // Copy backup to destination
    fs.copyFileSync(backupPath, destinationPath);

    console.log(`Backup exported to: ${destinationPath}`);

    return {
      success: true,
      message: 'Backup exported successfully'
    };
  } catch (error) {
    console.error('Error exporting backup:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Clean old backups based on retention policy
 * @param {number} retentionDays - Number of days to keep backups
 * @returns {Promise<{success: boolean, message: string, deletedCount?: number}>}
 */
async function cleanOldBackups(retentionDays = 30) {
  try {
    const backupsResult = await listBackups();
    
    if (!backupsResult.success) {
      return { success: false, message: 'Failed to list backups' };
    }

    const now = new Date();
    const cutoffDate = new Date(now.getTime() - (retentionDays * 24 * 60 * 60 * 1000));
    
    let deletedCount = 0;

    // Delete backups older than retention period
    // Keep pre-restore backups for safety
    for (const backup of backupsResult.backups) {
      const backupDate = new Date(backup.createdAt);
      
      // Don't delete pre-restore backups
      if (backup.type === 'pre-restore') {
        continue;
      }

      if (backupDate < cutoffDate) {
        const result = await deleteBackup(backup.fileName);
        if (result.success) {
          deletedCount++;
        }
      }
    }

    console.log(`Cleaned ${deletedCount} old backups`);

    return {
      success: true,
      message: `Cleaned ${deletedCount} old backup(s)`,
      deletedCount
    };
  } catch (error) {
    console.error('Error cleaning old backups:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Get information about a specific backup
 * @param {string} fileName - Name of the backup file
 * @returns {Promise<{success: boolean, info?: object, message?: string}>}
 */
async function getBackupInfo(fileName) {
  try {
    const backupsDir = getBackupsDir();
    const backupPath = path.join(backupsDir, fileName);
    
    // Check if backup file exists
    if (!fs.existsSync(backupPath)) {
      return { success: false, message: 'Backup file not found' };
    }

    const stats = fs.statSync(backupPath);
    
    // Parse the filename to extract type and date
    const parts = fileName.replace('.sqlite', '').split('_');
    const type = parts[1] || 'manual';

    return {
      success: true,
      info: {
        fileName,
        filePath: backupPath,
        size: stats.size,
        createdAt: stats.birthtime.toISOString(),
        modifiedAt: stats.mtime.toISOString(),
        type
      }
    };
  } catch (error) {
    console.error('Error getting backup info:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * Check if auto-backup is needed (daily backup)
 * @returns {Promise<{success: boolean, backupNeeded: boolean, lastBackupDate?: string}>}
 */
async function checkAutoBackupNeeded() {
  try {
    const backupsResult = await listBackups();
    
    if (!backupsResult.success) {
      return { success: true, backupNeeded: true };
    }

    // Find the most recent auto backup
    const autoBackups = backupsResult.backups.filter(b => b.type === 'auto');
    
    if (autoBackups.length === 0) {
      return { success: true, backupNeeded: true };
    }

    const lastAutoBackup = autoBackups[0]; // Already sorted newest first
    const lastBackupDate = new Date(lastAutoBackup.createdAt);
    const now = new Date();
    
    // Check if last backup was more than 24 hours ago
    const hoursSinceLastBackup = (now - lastBackupDate) / (1000 * 60 * 60);
    const backupNeeded = hoursSinceLastBackup >= 24;

    return {
      success: true,
      backupNeeded,
      lastBackupDate: lastAutoBackup.createdAt
    };
  } catch (error) {
    console.error('Error checking auto backup:', error);
    return {
      success: false,
      backupNeeded: false,
      message: error.message
    };
  }
}

/**
 * Sync the master backup - a single file that always mirrors the current database.
 * This overwrites the same file every time, keeping it up-to-date.
 * Uses VACUUM INTO for a clean, consistent copy.
 */
async function syncMasterBackup() {
  try {
    const backupsDir = getBackupsDir();
    const masterPath = path.join(backupsDir, 'database_master.sqlite');

    // Remove existing master backup before creating a new one
    // (VACUUM INTO fails if the target file already exists)
    if (fs.existsSync(masterPath)) {
      fs.unlinkSync(masterPath);
    }

    await runAsync(`VACUUM INTO ?`, [masterPath]);
    console.log('Master backup synced successfully.');

    return { success: true, message: 'Copia maestra actualizada' };
  } catch (error) {
    console.error('Error syncing master backup:', error);
    return { success: false, message: error.message };
  }
}

module.exports = {
  createBackup,
  listBackups,
  restoreBackup,
  deleteBackup,
  exportBackup,
  cleanOldBackups,
  getBackupInfo,
  checkAutoBackupNeeded,
  syncMasterBackup,
  getBackupsDir,
  getDatabasePath
};
