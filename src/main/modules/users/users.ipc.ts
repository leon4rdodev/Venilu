import { ipcMain } from 'electron';
import { UsersService } from '@main/modules/users/services/users.service';
import { RolesService } from '@main/modules/users/services/roles.service';
import { requirePermission, requireAuth, getSessionUser } from '@main/shared/session';
import { auditService } from '@main/modules/audit/services/audit.service';
import { IPCResponse } from '@shared/types/ipc';
import { User } from '@shared/types/models';

const usersService = new UsersService();
const rolesService = new RolesService();

export function registerUsersHandlers() {
  // ─── Auth ──────────────────────────────────────────────────────────────────

  /** Public — no session required */
  ipcMain.handle('login-request', async (_event, { username, password }): Promise<IPCResponse<User>> => {
    const user = await usersService.verifyCredentials(username, password);
    if (!user) return { success: false, message: 'Usuario o contraseña incorrectos.' };

    return {
      success: true,
      data: {
        id: user.id,
        role: user.role,
        name: user.name,
        username: user.username,
        role_id: user.role_id,
        role_entity: user.role_entity,
        // Permissions are included so the renderer can gate UI — the main process
        // always reloads them from DB via set-logged-in-user (never trusts this array).
        permissions: user.role_entity?.permissions ?? [],
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    };
  });

  /** Public — needed before login to detect onboarding state */
  ipcMain.handle('onboarding:check', async () => {
    return usersService.checkOnboardingStatus();
  });

  // ─── User management ───────────────────────────────────────────────────────

  ipcMain.handle('get-users', async () => {
    try {
      requirePermission('users:view');
      const users = await usersService.findAll();
      return { success: true, data: users };
    } catch (err: unknown) {
      return { success: false, message: err instanceof Error ? err.message : String(err) };
    }
  });

  /** Public during onboarding; requires users:manage afterward */
  ipcMain.handle('create-user', async (_event, userData) => {
    try {
      const onboarding = await usersService.checkOnboardingStatus();
      if (onboarding.completed) requirePermission('users:manage');
      const user = await usersService.create(userData);
      return { success: true, data: user };
    } catch (err: unknown) {
      return { success: false, message: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('update-user', async (_event, { userId, userData }) => {
    try {
      requirePermission('users:manage');
      await usersService.update(userId, userData);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, message: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('delete-user', async (_event, userId) => {
    try {
      requirePermission('users:manage');
      const user = await usersService.findOne(userId);
      await usersService.delete(userId);
      auditService.log('users:delete', userId, user?.username);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, message: err instanceof Error ? err.message : String(err) };
    }
  });

  // ─── Role management ───────────────────────────────────────────────────────

  ipcMain.handle('roles:list', async () => {
    try {
      requireAuth();
      const roles = await rolesService.findAll();
      return { success: true, data: roles };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('roles:create', async (_event, data) => {
    try {
      requirePermission('users:roles');
      const role = await rolesService.create(data);
      return { success: true, data: role };
    } catch (err: unknown) {
      return { success: false, message: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('roles:update', async (_event, { roleId, data }) => {
    try {
      requirePermission('users:roles');
      const role = await rolesService.update(roleId, data);
      return { success: true, data: role };
    } catch (err: unknown) {
      return { success: false, message: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('roles:delete', async (_event, roleId) => {
    try {
      requirePermission('users:roles');
      const role = await rolesService.findOne(roleId);
      await rolesService.delete(roleId);
      auditService.log('roles:delete', roleId, role?.name);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, message: err instanceof Error ? err.message : String(err) };
    }
  });
}
