import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Immutable audit trail for sensitive operations.
 * Records are never updated or deleted — append-only.
 *
 * Audited actions:
 *   - shifts:force_close
 *   - backup:restore
 *   - backup:delete
 *   - users:delete
 *   - roles:delete
 *   - inventory:delete (product)
 */
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** ID of the user who performed the action */
  @Column()
  user_id!: string;

  /** Username snapshot at the time of the action */
  @Column()
  username!: string;

  /**
   * Action identifier in the format "resource:verb".
   * Examples: "backup:restore", "users:delete", "shifts:force_close"
   */
  @Column()
  action!: string;

  /** ID of the entity that was affected (optional) */
  @Column({ nullable: true })
  target_id?: string;

  /** Human-readable description of the target (e.g. backup filename, username) */
  @Column({ nullable: true })
  target_label?: string;

  /** Additional context serialized as JSON */
  @Column({ nullable: true, type: 'text' })
  metadata?: string;

  @CreateDateColumn()
  created_at!: Date;
}
