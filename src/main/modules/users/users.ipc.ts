import { ipcMain } from 'electron';
import { UsersService } from '@main/modules/users/services/users.service';
import { RolesService } from '@main/modules/users/services/roles.service';
import { requirePermission, requireAuth, establishSession } from '@main/shared/session';
import { auditService } from '@main/modules/audit/services/audit.service';
import { IPCResponse } from '@shared/types/ipc';
import { User } from '@shared/types/models';

const usersService = new UsersService();
const rolesService = new RolesService();

export function registerUsersHandlers() {
  // ─── Auth ──────────────────────────────────────────────────────────────────

  /**
   * Public — no session required.
   * On success the main-process session is established here (the renderer can
   * never set a session by itself) and a session token is issued so the
   * renderer can restore the session across app restarts.
   */
  ipcMain.handle('login-request', async (_event, payload): Promise<IPCResponse<{ user: User; token: string }>> => {
    try {
      const username = payload?.username;
      const password = payload?.password;
      if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
        return { success: false, message: 'Usuario o contraseña incorrectos.' };
      }

      const user = await usersService.verifyCredentials(username, password);
      if (!user) return { success: false, message: 'Usuario o contraseña incorrectos.' };

      const token = await usersService.issueSessionToken(user.id);
      await establishSession(user.id);

      return {
        success: true,
        data: {
          user: {
            id: user.id,
            role: user.role,
            name: user.name,
            username: user.username,
            role_id: user.role_id,
            role_entity: user.role_entity,
            // Permissions are included so the renderer can gate UI — the main
            // process only ever trusts its own session store.
            permissions: user.role_entity?.permissions ?? [],
            created_at: user.created_at,
            updated_at: user.updated_at,
          } as User,
          token,
        },
      };
    } catch (err: unknown) {
      console.error('[users.ipc] login-request:', err);
      return { success: false, message: 'Ocurrió un error durante el inicio de sesión.' };
    }
  });

  /** Public — needed before login to detect onboarding state */
  ipcMain.handle('onboarding:check', async () => {
    return usersService.checkOnboardingStatus();
  });

  /**
   * Public — feeds the login user picker (shared-terminal pattern).
   * Returns display data only; authentication still goes through
   * login-request with the password.
   */
  ipcMain.handle('login:list-users', async () => {
    try {
      const profiles = await usersService.listLoginProfiles();
      return { success: true, data: profiles };
    } catch (err: unknown) {
      console.error('[users.ipc] login:list-users:', err);
      return { success: false, message: 'No se pudo cargar la lista de usuarios.' };
    }
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

      // Onboarding: establish the session for the just-created first admin so
      // the wizard can finish the initial configuration (settings:update).
      if (!onboarding.completed) {
        await establishSession(user.id);
      }

      return { success: true, data: UsersService.toSafeUser(user) };
    } catch (err: unknown) {
      return { success: false, message: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('update-user', async (_event, { userId, userData }) => {
    try {
      const actor = requirePermission('users:manage');
      await usersService.update(userId, userData, actor.id);
      return { success: true };
    } catch (err: unknown) {
      return { success: false, message: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('delete-user', async (_event, userId) => {
    try {
      const actor = requirePermission('users:manage');
      const user = await usersService.findOne(userId);
      await usersService.delete(userId, actor.id);
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
    } catch (err: unknown) {
      return { success: false, message: err instanceof Error ? err.message : String(err) };
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
