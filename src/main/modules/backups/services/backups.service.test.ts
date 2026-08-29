import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { initTestDb, closeTestDb } from '../../../../test/db';
import { BackupsService } from './backups.service';
import { SettingsService } from '@main/modules/settings/services/settings.service';

const backupsDir = () => path.join(app.getPath('userData'), 'backups');

const listFiles = () =>
  fs.existsSync(backupsDir())
    ? fs.readdirSync(backupsDir()).filter(f => f.endsWith('.sqlite'))
    : [];

const autoFiles = () => listFiles().filter(f => f.startsWith('backup_auto_'));

/** Vacía el directorio de backups entre tests. */
const cleanBackupsDir = () => {
  if (!fs.existsSync(backupsDir())) return;
  for (const f of fs.readdirSync(backupsDir())) {
    fs.unlinkSync(path.join(backupsDir(), f));
  }
};

describe('BackupsService', () => {
  let service: BackupsService;
  let settings: SettingsService;

  beforeAll(async () => {
    await initTestDb();
    service = new BackupsService();
    settings = new SettingsService();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    cleanBackupsDir();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── createBackup ───────────────────────────────────────────────────────────

  describe('createBackup', () => {
    it('crea un archivo SQLite válido con nombre backup_manual_*', async () => {
      const result = await service.createBackup('manual');
      expect(result.success).toBe(true);
      expect(result.fileName).toMatch(/^backup_manual_.+\.sqlite$/);
      expect(fs.existsSync(result.filePath)).toBe(true);

      const header = Buffer.alloc(16);
      const fd = fs.openSync(result.filePath, 'r');
      fs.readSync(fd, header, 0, 16, 0);
      fs.closeSync(fd);
      expect(header.toString('utf8')).toContain('SQLite format 3');
    });

    it('dos backups en el mismo instante NO colisionan (guard de nombre)', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-08-25T12:00:00.000Z'));

      const first = await service.createBackup('manual');
      const second = await service.createBackup('manual');

      expect(first.success).toBe(true);
      expect(second.success).toBe(true);
      expect(second.fileName).not.toBe(first.fileName);
      expect(second.fileName).toMatch(/-1\.sqlite$/); // sufijo de colisión
      expect(fs.existsSync(first.filePath)).toBe(true);
      expect(fs.existsSync(second.filePath)).toBe(true);
    });

    it('un tipo desconocido cae a manual', async () => {
      const result = await service.createBackup('evil/../type' as never);
      expect(result.success).toBe(true);
      expect(result.fileName).toMatch(/^backup_manual_/);
    });
  });

  // ─── listBackups ────────────────────────────────────────────────────────────

  describe('listBackups', () => {
    it('lista los .sqlite con metadatos y excluye otros archivos', async () => {
      await service.createBackup('manual');
      fs.writeFileSync(path.join(backupsDir(), 'notas.txt'), 'no soy un backup');

      const result = await service.listBackups();
      expect(result.success).toBe(true);
      expect(result.backups).toHaveLength(1);
      expect(result.backups![0].type).toBe('manual');
      expect(result.backups![0].size).toBeGreaterThan(0);
    });
  });

  // ─── sanitizeFileName (vía deleteBackup / restoreBackup) ────────────────────

  describe('sanitización de nombres', () => {
    it('deleteBackup rechaza path traversal y nombres raros', async () => {
      for (const evil of ['../../etc/passwd', '/etc/passwd', 'a b.sqlite', 'x.txt', 'x$;.sqlite', '']) {
        const result = await service.deleteBackup(evil);
        expect(result.success).toBe(false);
        expect(result.message).toMatch(/inválido/);
      }
    });

    it('deleteBackup elimina un backup válido y reporta inexistentes', async () => {
      const created = await service.createBackup('manual');
      const del = await service.deleteBackup(created.fileName);
      expect(del.success).toBe(true);
      expect(fs.existsSync(created.filePath)).toBe(false);

      const missing = await service.deleteBackup('backup_manual_no-existe.sqlite');
      expect(missing.success).toBe(false);
      expect(missing.message).toMatch(/not found/i);
    });

    it('restoreBackup neutraliza traversal antes de tocar la BD', async () => {
      // basename() no termina en .sqlite → rechazado por el regex
      await expect(service.restoreBackup('../../etc/passwd')).rejects.toThrow(/inválido/);
      // basename() lo reduce a un nombre seguro DENTRO del dir de backups
      const result = await service.restoreBackup('../database.sqlite');
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/not found/i);
    });

    it('restoreBackup con un nombre válido pero inexistente devuelve not found', async () => {
      const result = await service.restoreBackup('backup_manual_fantasma.sqlite');
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/not found/i);
    });

    it('restoreBackup rechaza un archivo que no es SQLite', async () => {
      const fake = path.join(backupsDir(), 'backup_manual_falso.sqlite');
      fs.writeFileSync(fake, 'esto no es una base de datos');
      const result = await service.restoreBackup('backup_manual_falso.sqlite');
      expect(result.success).toBe(false);
      expect(result.message).toMatch(/no es una base de datos SQLite/);
    });
  });

  // ─── runAutoBackupIfDue ─────────────────────────────────────────────────────

  describe('runAutoBackupIfDue', () => {
    it("con auto_backup 'off' no crea nada", async () => {
      await settings.update({ auto_backup: 'off' });
      await service.runAutoBackupIfDue();
      expect(autoFiles()).toHaveLength(0);
    });

    it("con 'daily' y sin backups previos crea el primero", async () => {
      await settings.update({ auto_backup: 'daily' });
      await service.runAutoBackupIfDue();
      expect(autoFiles()).toHaveLength(1);
      expect(autoFiles()[0]).toMatch(/^backup_auto_/);
    });

    it('NO crea otro si hay uno fresco (menos de 24h)', async () => {
      await settings.update({ auto_backup: 'daily' });
      await service.runAutoBackupIfDue();
      expect(autoFiles()).toHaveLength(1);
      await service.runAutoBackupIfDue();
      expect(autoFiles()).toHaveLength(1);
    });

    it('crea uno nuevo cuando el más reciente ya venció el intervalo', async () => {
      await settings.update({ auto_backup: 'daily', auto_backup_retention: 7 } as never);
      await service.runAutoBackupIfDue();
      const [stale] = autoFiles();
      // Envejecemos el backup 2 días
      const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      fs.utimesSync(path.join(backupsDir(), stale), old, old);

      await service.runAutoBackupIfDue();
      expect(autoFiles()).toHaveLength(2);
    });

    it("con 'weekly' un backup de 2 días sigue siendo fresco", async () => {
      await settings.update({ auto_backup: 'weekly' });
      await service.runAutoBackupIfDue();
      const [recent] = autoFiles();
      const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      fs.utimesSync(path.join(backupsDir(), recent), old, old);

      await service.runAutoBackupIfDue();
      expect(autoFiles()).toHaveLength(1);
    });

    it('poda los backups auto que exceden la retención (los más viejos primero)', async () => {
      await settings.update({ auto_backup: 'daily', auto_backup_retention: 2 } as never);

      // Cuatro backups auto envejecidos con mtimes escalonados (3-6 días)
      const day = 24 * 60 * 60 * 1000;
      for (let i = 0; i < 4; i++) {
        const result = await service.createBackup('auto');
        const when = new Date(Date.now() - (3 + i) * day);
        fs.utimesSync(result.filePath, when, when);
      }
      expect(autoFiles()).toHaveLength(4);

      await service.runAutoBackupIfDue();

      // Crea el nuevo y deja solo `retention` en total
      const remaining = autoFiles()
        .map(f => ({ name: f, mtime: fs.statSync(path.join(backupsDir(), f)).mtime.getTime() }))
        .sort((a, b) => b.mtime - a.mtime);
      expect(remaining).toHaveLength(2);
      // El más nuevo es el recién creado (mtime ~ahora)
      expect(Date.now() - remaining[0].mtime).toBeLessThan(60_000);
    });

    it('la poda no toca los backups manuales', async () => {
      await settings.update({ auto_backup: 'daily', auto_backup_retention: 1 } as never);
      const manual = await service.createBackup('manual');
      const day = 24 * 60 * 60 * 1000;
      for (let i = 0; i < 2; i++) {
        const result = await service.createBackup('auto');
        const when = new Date(Date.now() - (3 + i) * day);
        fs.utimesSync(result.filePath, when, when);
      }

      await service.runAutoBackupIfDue();
      expect(autoFiles()).toHaveLength(1);
      expect(fs.existsSync(manual.filePath)).toBe(true);
    });

    it('nunca lanza (traga errores internos)', async () => {
      await settings.update({ auto_backup: 'off' });
      await expect(service.runAutoBackupIfDue()).resolves.toBeUndefined();
    });
  });
});
