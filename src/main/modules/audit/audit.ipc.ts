import { ipcMain } from 'electron';
import { AppDataSource } from '@main/config/data-source';
import { AuditLog } from '@main/modules/audit/entities/audit-log.entity';
import { requirePermission } from '@main/shared/session';

interface AuditListOptions {
  page?: number;
  pageSize?: number;
  action?: string;
  search?: string;
}

export function registerAuditHandlers() {
  /**
   * Paginated, filterable audit trail — Ajustes → Actividad.
   * Payload: { page, pageSize, action?, search? }
   * Returns: { success, data: { items, total, page, pageSize, totalPages } }
   */
  ipcMain.handle('audit:list', async (_event, options: AuditListOptions = {}) => {
    try {
      requirePermission('audit:view');

      const page = Math.max(1, Number(options.page) || 1);
      const pageSize = Math.min(50, Math.max(1, Number(options.pageSize) || 15));

      const qb = AppDataSource.getRepository(AuditLog)
        .createQueryBuilder('log')
        .orderBy('log.created_at', 'DESC');

      if (typeof options.action === 'string' && options.action) {
        qb.andWhere('log.action = :action', { action: options.action });
      }
      if (typeof options.search === 'string' && options.search.trim()) {
        qb.andWhere('(log.username LIKE :q OR log.target_label LIKE :q)', {
          q: `%${options.search.trim()}%`,
        });
      }

      const [items, total] = await qb
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .getManyAndCount();

      return {
        success: true,
        data: {
          items,
          total,
          page,
          pageSize,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
      };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  /** Distinct action identifiers present in the log — feeds the filter select. */
  ipcMain.handle('audit:actions', async () => {
    try {
      requirePermission('audit:view');
      const rows = await AppDataSource.getRepository(AuditLog)
        .createQueryBuilder('log')
        .select('DISTINCT log.action', 'action')
        .orderBy('log.action', 'ASC')
        .getRawMany();
      return { success: true, data: rows.map(r => String(r.action)) };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });
}
