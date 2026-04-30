import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Shift } from '@main/modules/shifts/entities/shift.entity';
import { Sale } from '@main/modules/sales/entities/sale.entity';
import { Role } from '@main/modules/users/entities/role.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  username!: string;

  @Column()
  password!: string;

  @Column()
  name!: string;

  /**
   * Legacy role field kept for backward compatibility and onboarding checks.
   * The authoritative permission source is the related Role entity.
   */
  @Column({ default: 'employee' })
  role!: 'admin' | 'employee';

  /**
   * FK to the assigned Role.
   * nullable — populated by the migration seeder on first boot for existing users.
   */
  @Column({ nullable: true })
  role_id?: string;

  /**
   * Eagerly loaded Role entity so permissions are always available
   * without an extra query.
   */
  @ManyToOne(() => Role, { nullable: true, eager: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'role_id' })
  role_entity?: Role;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @OneToMany(() => Shift, (shift) => shift.user)
  shifts?: Shift[];

  @OneToMany(() => Sale, (sale) => sale.user)
  sales?: Sale[];
}

