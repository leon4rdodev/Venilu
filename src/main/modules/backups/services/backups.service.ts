import { AppDataSource } from "@main/config/data-source";
import { app } from "electron";
import path from "path";
import fs from "fs";

export class BackupsService {
    private getBackupsDir(): string {
        const userDataPath = app.getPath('userData');
        const backupsDir = path.join(userDataPath, 'backups');
        if (!fs.existsSync(backupsDir)) {
            fs.mkdirSync(backupsDir, { recursive: true });
        }
        return backupsDir;
    }

    /** Rejects any path components — backups are addressed by bare file name only. */
    private sanitizeFileName(fileName: unknown): string {
        const name = path.basename(String(fileName ?? ''));
        if (!/^[A-Za-z0-9._-]+\.sqlite$/.test(name)) {
            throw new Error('Nombre de archivo de backup inválido.');
        }
        return name;
    }

    async createBackup(type: 'manual' | 'auto' = 'manual'): Promise<any> {
        if (type !== 'manual' && type !== 'auto') type = 'manual';
        try {
            const backupsDir = this.getBackupsDir();
            const now = new Date();
            const timestamp = now.toISOString().replace(/:/g, '-').replace(/\./g, '-').substring(0, 19);
            const fileName = `backup_${type}_${timestamp}.sqlite`;
            const backupPath = path.join(backupsDir, fileName);

            // Use TypeORM's query runner to execute VACUUM INTO
            await AppDataSource.query(`VACUUM INTO ?`, [backupPath]);

            return {
                success: true,
                message: 'Backup created successfully',
                fileName,
                filePath: backupPath
            };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    async listBackups() {
        try {
            const backupsDir = this.getBackupsDir();
            const files = fs.readdirSync(backupsDir);

            const backups = files
                .filter(file => file.endsWith('.sqlite') && !file.includes('database_master'))
                .map(fileName => {
                    const filePath = path.join(backupsDir, fileName);
                    const stats = fs.statSync(filePath);
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
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            return { success: true, backups };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }

    async restoreBackup(fileName: string) {
        // Build path — fileName is sanitized to a bare file name (no traversal)
        const backupsDir = this.getBackupsDir();
        const backupPath = path.join(backupsDir, this.sanitizeFileName(fileName));

        if (!fs.existsSync(backupPath)) {
             return { success: false, message: "Backup file not found" };
        }

        // Verify the file is actually a SQLite database before overwriting the live DB
        const header = Buffer.alloc(16);
        const fd = fs.openSync(backupPath, 'r');
        try {
            fs.readSync(fd, header, 0, 16, 0);
        } finally {
            fs.closeSync(fd);
        }
        if (!header.toString('utf8').startsWith('SQLite format 3')) {
            return { success: false, message: "El archivo no es una base de datos SQLite válida." };
        }

        // Ideally, we should close the connection, copy file, and reopen.
        // But closing AppDataSource might be tricky if other things are using it.
        // However, standard SQlite restore usually requires closing the file lock.
        
        try {
             await AppDataSource.destroy(); // Close connection
             
             const dbPath = AppDataSource.options.database as string;
             
             // Create safety backup
             const preRestorePath = path.join(backupsDir, `backup_pre-restore_${Date.now()}.sqlite`);
             if (fs.existsSync(dbPath)) {
                 fs.copyFileSync(dbPath, preRestorePath);
             }

             // Restore
             fs.copyFileSync(backupPath, dbPath);
             
             // Clean WAL/SHM
             if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
             if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');

             // Reconnect
             await AppDataSource.initialize();
             
             return { success: true, message: "Database restored successfully" };
        } catch (error: any) {
             // Try to reconnect if failed
             if (!AppDataSource.isInitialized) await AppDataSource.initialize();
             return { success: false, message: error.message };
        }
    }
    
    async deleteBackup(fileName: string) {
        try {
            const backupsDir = this.getBackupsDir();
            const filePath = path.join(backupsDir, this.sanitizeFileName(fileName));
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                return { success: true, message: "Backup deleted" };
            }
            return { success: false, message: "File not found" };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    }
}
