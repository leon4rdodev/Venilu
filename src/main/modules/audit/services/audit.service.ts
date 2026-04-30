import { AppDataSource } from '@main/config/data-source';
import { AuditLog } from '@main/modules/audit/entities/audit-log.entity';
import { getSessionUser } from '@main/shared/session';

export class AuditService {
  private repo = AppDataSource.getRepository(AuditLog);

  /**
   * Log a sensitive action. Fire-and-forget — never throws or blocks the caller.
   *
   * @param action     Action identifier e.g. "backup:restore", "shifts:force_close"
   * @param targetId   ID of the affected entity (optional)
   * @param targetLabel Human-readable label for the target (optional)
   * @param metadata   Any extra context (will be JSON-serialized)
   */
  log(
    action: string,
    targetId?: string,
    targetLabel?: string,
    metadata?: Record<string, unknown>,
  ): void {
    const session = getSessionUser();
    const entry = this.repo.create({
      user_id: session?.id ?? 'unknown',
      username: session?.username ?? 'unknown',
      action,
      target_id: targetId,
      target_label: targetLabel,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    });

    // Fire-and-forget: log failure must never break the caller's flow
    this.repo.save(entry).catch((err) => {
      console.error('[AuditService] Failed to write audit log:', err);
    });
  }
}

/** Singleton — one instance shared across all IPC handlers */
export const auditService = new AuditService();
