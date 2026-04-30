import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ALL_PERMISSIONS } from '@shared/permissions';

/**
 * A named role with a set of granular permission strings.
 * Roles are assigned to users; the user inherits all permissions of their role.
 *
 * System roles (is_system = true) are seeded automatically and cannot be
 * edited or deleted through the UI or API.
 */
@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  name!: string;

  /**
   * Prevents the role from being mutated or removed.
   * True for the built-in "Administrador" and "Empleado Base" roles.
   */
  @Column({ default: false })
  is_system!: boolean;

  /**
   * Flat array of permission strings (e.g. ["pos:access", "inventory:view"]).
   * Stored as JSON in SQLite via TypeORM's simple-json transformer.
   * Must be a subset of ALL_PERMISSIONS.
   */
  @Column('simple-json', { default: JSON.stringify([]) })
  permissions!: string[];

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}

/** Names for the built-in system roles — used by the seeder and migration. */
export const SYSTEM_ROLE_NAMES = {
  ADMIN: 'Administrador',
  EMPLOYEE: 'Empleado Base',
} as const;
