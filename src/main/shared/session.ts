/**
 * Server-side session management for the Electron main process.
 *
 * This is the single source of truth for the authenticated user and their
 * permissions. The renderer process CANNOT forge or escalate permissions because:
 *
 *   1. The session is only established by a successful `login-request` (or by
 *      `session:restore` presenting the session token issued at login).
 *   2. Permissions are ALWAYS re-fetched from the database — never trusted
 *      from any renderer payload.
 *   3. requirePermission() reads from this in-memory store, never from the renderer.
 */

import { ipcMain } from 'electron';
import { UsersService } from '@main/modules/users/services/users.service';

// ─── Session state ────────────────────────────────────────────────────────────

export interface SessionUser {
  id: string;
  /** Legacy field — kept for onboarding checks */
  role: 'admin' | 'employee';
  username: string;
  name: string;
  /** Granular permissions loaded from the user's Role entity in the DB. */
  permissions: string[];
  /**
   * True when the user has a Role entity assigned. Only a legacy admin
   * WITHOUT a role entity bypasses granular checks — an assigned role with an
   * empty permissions array grants nothing.
   */
  hasRoleEntity: boolean;
}

let currentUser: SessionUser | null = null;

// ─── Accessors ────────────────────────────────────────────────────────────────

/** Returns the current session user or null if nobody is logged in. */
export function getSessionUser(): SessionUser | null {
  return currentUser;
}

// ─── Guard functions ─────────────────────────────────────────────────────────

/**
 * Asserts that there is an authenticated user.
 * Throws with a user-facing message on failure (caught by IPC handlers).
 */
export function requireAuth(): SessionUser {
  if (!currentUser) throw new Error('No hay sesión activa.');
  return currentUser;
}

/**
 * Legacy admins (role='admin' with NO role entity) bypass granular checks —
 * backward compatibility for installs created before the RBAC migration.
 * A user with an assigned role — even one with zero permissions — never bypasses.
 */
function isLegacyAdmin(user: SessionUser): boolean {
  return user.role === 'admin' && !user.hasRoleEntity;
}

/** Asserts that the current user has (at least one of) the given permission(s). */
export function requirePermission(permission: string | string[]): SessionUser {
  if (!currentUser) throw new Error('No hay sesión activa.');
  if (isLegacyAdmin(currentUser)) return currentUser;

  const permissionsToCheck = Array.isArray(permission) ? permission : [permission];
  const hasAny = permissionsToCheck.some(p => currentUser!.permissions.includes(p));

  if (!hasAny) {
    console.error(`[Session] Permission Denied. Required: ${permissionsToCheck.join(' OR ')}.`);
    throw new Error(`Sin permiso para realizar esta acción (${permissionsToCheck.join(' o ')}).`);
  }

  return currentUser;
}

/**
 * Returns whether the current session has a given permission.
 * Non-throwing variant suitable for conditional logic in IPC handlers.
 */
export function hasPermission(permission: string): boolean {
  if (!currentUser) return false;
  if (isLegacyAdmin(currentUser)) return true;
  return currentUser.permissions.includes(permission);
}

/**
 * Legacy guard kept for old call sites. Prefer requirePermission().
 * @deprecated Use requirePermission() instead.
 */
export function requireRole(role: 'admin' | 'employee'): SessionUser {
  if (!currentUser) throw new Error('No hay sesión activa.');
  if (role === 'admin' && currentUser.role !== 'admin') {
    throw new Error('Se requiere rol de administrador.');
  }
  return currentUser;
}

// ─── Session operations ───────────────────────────────────────────────────────

/**
 * Loads the user + role from the database and sets the in-memory session.
 * Only callable from the main process (login, onboarding first-admin, restore).
 *
 * @returns true if the session was established, false if user not found.
 */
export async function establishSession(userId: string): Promise<boolean> {
  try {
    const usersService = new UsersService();
    const user = await usersService.findOneWithRole(userId);

    if (!user) {
      console.warn(`[Session] establishSession: user ${userId} not found in DB.`);
      return false;
    }

    currentUser = {
      id: user.id,
      role: user.role,
      username: user.username,
      name: user.name,
      permissions: user.role_entity?.permissions ?? [],
      hasRoleEntity: !!user.role_entity,
    };

    console.log(`[Session] Established: ${user.username} (${user.role})`);
    return true;
  } catch (err) {
    console.error('[Session] establishSession error:', err);
    return false;
  }
}

/** Clears the in-memory session (does not touch the DB token). */
export function clearSession(): void {
  currentUser = null;
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────

/** Registers the session IPC handlers. Must be called before other handlers. */
export function registerSessionHandlers() {
  /**
   * Restores a session persisted by the renderer across app restarts.
   * Requires the session token issued by `login-request` — a bare userId is
   * NOT enough to obtain a session.
   */
  ipcMain.handle('session:restore', async (_event, payload: { userId?: string; token?: string }) => {
    try {
      const userId = payload?.userId;
      const token = payload?.token;
      if (typeof userId !== 'string' || !userId || typeof token !== 'string' || !token) {
        return { success: false, message: 'Sesión inválida. Inicia sesión de nuevo.' };
      }

      const usersService = new UsersService();
      const valid = await usersService.verifySessionToken(userId, token);
      if (!valid) {
        return { success: false, message: 'La sesión ha expirado. Inicia sesión de nuevo.' };
      }

      const ok = await establishSession(userId);
      return { success: ok, message: ok ? undefined : 'Usuario no encontrado.' };
    } catch (err) {
      console.error('[Session] session:restore error:', err);
      return { success: false, message: 'Error al restaurar la sesión.' };
    }
  });

  /**
   * Re-loads the current user from the DB (e.g. after editing your own account)
   * and returns the sanitized user so the renderer can update its local copy.
   */
  ipcMain.handle('session:refresh', async () => {
    try {
      const session = requireAuth();
      const usersService = new UsersService();
      const user = await usersService.findOneWithRole(session.id);
      if (!user) {
        currentUser = null;
        return { success: false, message: 'Usuario no encontrado.' };
      }
      await establishSession(user.id);
      return { success: true, data: UsersService.toSafeUser(user) };
    } catch (err: unknown) {
      return { success: false, message: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('logout', async () => {
    try {
      if (currentUser) {
        await new UsersService().clearSessionToken(currentUser.id);
      }
    } catch (err) {
      console.error('[Session] logout token cleanup error:', err);
    }
    console.log(`[Session] Logged out: ${currentUser?.username ?? 'unknown'}`);
    currentUser = null;
    return { success: true };
  });
}
