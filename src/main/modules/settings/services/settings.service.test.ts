import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initTestDb, closeTestDb } from '../../../../test/db';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;

  beforeAll(async () => {
    await initTestDb();
    service = new SettingsService();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it('creates defaults on first get (auto_backup daily, retention 7)', async () => {
    const settings = await service.get();
    expect(settings.business_name).toBe('Venilu');
    expect(settings.paper_size).toBe('80mm');
    expect(settings.auto_backup).toBe('daily');
    expect(Number(settings.auto_backup_retention)).toBe(7);
  });

  it('persists whitelisted fields including the new ones', async () => {
    await service.update({
      business_name: 'Colmado Prueba',
      receipt_footer: 'Gracias!\nVuelva pronto',
      auto_backup: 'weekly',
      auto_backup_retention: 3,
    });
    const settings = await service.get();
    expect(settings.business_name).toBe('Colmado Prueba');
    expect(settings.receipt_footer).toContain('Vuelva pronto');
    expect(settings.auto_backup).toBe('weekly');
    expect(Number(settings.auto_backup_retention)).toBe(3);
  });

  it('ignores non-whitelisted fields', async () => {
    await service.update({ id: 99, evil_field: 'x' } as never);
    const settings = await service.get();
    expect(settings.id).toBe(1);
    expect((settings as never)['evil_field']).toBeUndefined();
  });

  it('rejects invalid paper_size, auto_backup and retention', async () => {
    await expect(service.update({ paper_size: 'A4' })).rejects.toThrow();
    await expect(service.update({ auto_backup: 'hourly' })).rejects.toThrow();
    await expect(service.update({ auto_backup_retention: 0 } as never)).rejects.toThrow();
    await expect(service.update({ auto_backup_retention: 99 } as never)).rejects.toThrow();
  });

  it('strips path components from logo_filename', async () => {
    await service.update({ logo_filename: '../../etc/passwd' });
    const settings = await service.get();
    expect(settings.logo_filename).toBe('passwd');
  });

  it('truncates receipt_footer to 300 chars', async () => {
    await service.update({ receipt_footer: 'x'.repeat(500) });
    const settings = await service.get();
    expect(settings.receipt_footer).toHaveLength(300);
  });
});
