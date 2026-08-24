import { Repository } from 'typeorm';
import { AppDataSource } from '@main/config/data-source';
import { Role, SYSTEM_ROLE_NAMES } from '@main/modules/users/entities/role.entity';
import { User } from '@main/modules/users/entities/user.entity';
import { ALL_PERMISSIONS, EMPLOYEE_BASE_PERMISSIONS, Permission } from '@shared/permissions';

export class RolesService {
  private roleRepo: Repository<Role>;
  private userRepo: Repository<User>;

  constructor() {
    this.roleRepo = AppDataSource.getRepository(Role);
    this.userRepo = AppDataSource.getRepository(User);
  }

  // ─── Public CRUD ──────────────────────────────────────────────────────────

  async findAll(): Promise<Role[]> {
    return this.roleRepo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<Role | null> {
    return this.roleRepo.findOneBy({ id });
  }

  async create(data: { name: string; permissions: string[] }): Promise<Role> {
    const name = typeof data?.name === 'string' ? data.name.trim() : '';
    if (!name) throw new Error('El nombre del rol es requerido.');
    if (!Array.isArray(data.permissions) || data.permissions.length === 0) {
      throw new Error('El rol debe tener al menos un permiso.');
    }

    const existing = await this.roleRepo.findOneBy({ name });
    if (existing) throw new Error(`Ya existe un rol llamado "${name}".`);

    this.validatePermissions(data.permissions);

    const role = this.roleRepo.create({
      name,
      is_system: false,
      permissions: data.permissions,
    });
    return this.roleRepo.save(role);
  }

  async update(id: string, data: { name?: string; permissions?: string[] }): Promise<Role> {
    const role = await this.findOneOrFail(id);
    
    if (role.is_system && role.name === SYSTEM_ROLE_NAMES.ADMIN) {
      throw new Error('El rol de Administrador no puede modificarse.');
    }

    if (data.name && data.name !== role.name) {
      if (role.is_system) throw new Error('No puedes cambiar el nombre de un rol del sistema.');
      const duplicate = await this.roleRepo.findOneBy({ name: data.name });
      if (duplicate && duplicate.id !== id)
        throw new Error(`Ya existe un rol llamado "${data.name}".`);
      role.name = data.name.trim();
    }

    if (data.permissions !== undefined) {
      if (!Array.isArray(data.permissions) || data.permissions.length === 0) {
        throw new Error('El rol debe tener al menos un permiso.');
      }
      this.validatePermissions(data.permissions);
      role.permissions = data.permissions;
    }

    return this.roleRepo.save(role);
  }

  async delete(id: string): Promise<void> {
    const role = await this.findOneOrFail(id);
    if (role.is_system) throw new Error('Los roles del sistema no pueden eliminarse.');
    
    // Fallback users to Empleado Base
    const employeeRole = await this.roleRepo.findOneBy({ name: SYSTEM_ROLE_NAMES.EMPLOYEE });
    if (employeeRole) {
      await this.userRepo
        .createQueryBuilder()
        .update(User)
        .set({ role_id: employeeRole.id })
        .where("role_id = :id", { id })
        .execute();
    }

    await this.roleRepo.delete(id);
  }

  // ─── Seeding & migration (called once on app init) ────────────────────────

  /**
   * Upsert the two built-in system roles.
   * Safe to call on every boot — idempotent.
   */
  async seedSystemRoles(): Promise<void> {
    await this.upsertSystemRole(SYSTEM_ROLE_NAMES.ADMIN, ALL_PERMISSIONS, true);
    await this.upsertSystemRole(SYSTEM_ROLE_NAMES.EMPLOYEE, EMPLOYEE_BASE_PERMISSIONS, false);
    console.log('[RolesService] System roles seeded.');
  }

  /**
   * Assigns a role_id to existing users that don't have one yet.
   * - role='admin'    → Administrador
   * - role='employee' → Empleado Base
   * Idempotent — only processes users where role_id IS NULL.
   */
  async migrateExistingUsers(): Promise<void> {
    const [adminRole, employeeRole] = await Promise.all([
      this.roleRepo.findOneBy({ name: SYSTEM_ROLE_NAMES.ADMIN }),
      this.roleRepo.findOneBy({ name: SYSTEM_ROLE_NAMES.EMPLOYEE }),
    ]);

    if (!adminRole || !employeeRole) {
      console.warn('[RolesService] Cannot migrate users — system roles not found.');
      return;
    }

    const usersWithoutRole = await this.userRepo
      .createQueryBuilder('user')
      .where('user.role_id IS NULL')
      .getMany();

    for (const user of usersWithoutRole) {
      user.role_id = user.role === 'admin' ? adminRole.id : employeeRole.id;
    }

    if (usersWithoutRole.length > 0) {
      await this.userRepo.save(usersWithoutRole);
      console.log(`[RolesService] Migrated ${usersWithoutRole.length} user(s) to role-based system.`);
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async findOneOrFail(id: string): Promise<Role> {
    const role = await this.findOne(id);
    if (!role) throw new Error('Rol no encontrado.');
    return role;
  }

  private async upsertSystemRole(name: string, permissions: string[], forcePermissions: boolean): Promise<void> {
    const existing = await this.roleRepo.findOneBy({ name });
    if (existing) {
      if (forcePermissions) {
        existing.permissions = permissions;
      }
      existing.is_system = true;
      await this.roleRepo.save(existing);
    } else {
      await this.roleRepo.save(
        this.roleRepo.create({ name, is_system: true, permissions }),
      );
    }
  }

  /** Rejects any permission string not in the known registry. */
  private validatePermissions(permissions: string[]): void {
    const unknown = permissions.filter((p) => !(ALL_PERMISSIONS as string[]).includes(p));
    if (unknown.length > 0)
      throw new Error(`Permisos desconocidos: ${unknown.join(', ')}`);
  }
}
