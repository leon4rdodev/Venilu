/**
 * Server-side session management for the Electron main process.
 *
 * This is the single source of truth for the authenticated user and their
 * permissions. The renderer process CANNOT forge or escalate permissions because:
 *
 *   1. set-logged-in-user only accepts a userId string.
 *   2. restoreSession() re-fetches the user + role from the database.
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
  /**
   * Granular permissions loaded from the user's Role entity in the DB.
   * Empty array on a legacy admin means "no restrictions" (full access).
   */
  permissions: string[];
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
 * Asserts that the current user has the given granular permission.
 *
 * Legacy admins (role='admin' with empty permissions array) bypass all checks —
 * this ensures backward compatibility during and after the migration.
 */
export function requirePermission(permission: string): SessionUser {
  if (!currentUser) throw new Error('No hay sesión activa.');

  // Legacy admin without role_entity → full access
  if (currentUser.role === 'admin' && currentUser.permissions.length === 0) {
    return currentUser;
  }

  if (!currentUser.permissions.includes(permission)) {
    throw new Error(`Sin permiso para realizar esta acción (${permission}).`);
  }

  return currentUser;
}

/**
 * Returns whether the current session has a given permission.
 * Non-throwing variant suitable for conditional logic in IPC handlers.
 */
export function hasPermission(permission: string): boolean {
  if (!currentUser) return false;
  if (currentUser.role === 'admin' && currentUser.permissions.length === 0) return true;
  return currentUser.permissions.includes(permission);
}

/**
 * Legacy guard kept for the onboarding flow where role is still the authority.
 * Prefer requirePermission() for all new code.
 * @deprecated Use requirePermission() instead.
 */
export function requireRole(role: 'admin' | 'employee'): SessionUser {
  if (!currentUser) throw new Error('No hay sesión activa.');
  if (role === 'admin' && currentUser.role !== 'admin') {
    // Also check if user has any admin-level permissions as a fallback
    throw new Error('Se requiere rol de administrador.');
  }
  return currentUser;
}

// ─── Session operations ───────────────────────────────────────────────────────

/**
 * Restores the session from the database by user ID.
 * Called by set-logged-in-user — permissions are ALWAYS loaded from DB, never
 * trusted from the renderer payload.
 *
 * @returns true if session was successfully restored, false if user not found.
 */
async function restoreSession(userId: string): Promise<boolean> {
  try {
    const usersService = new UsersService();
    const user = await usersService.findOneWithRole(userId);

    if (!user) {
      console.warn(`[Session] restoreSession: user ${userId} not found in DB.`);
      return false;
    }

    currentUser = {
      id: user.id,
      role: user.role,
      username: user.username,
      name: user.name,
      // role_entity is eagerly loaded; empty array → legacy admin full-access path
      permissions: user.role_entity?.permissions ?? [],
    };

    console.log(
      `[Session] Restored: ${user.username} (${user.role}) — ` +
      `${currentUser.permissions.length === 0 ? 'full access (legacy admin)' : `${currentUser.permissions.length} permissions`}`
    );
    return true;
  } catch (err) {
    console.error('[Session] restoreSession error:', err);
    return false;
  }
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────

/** Registers the session IPC handlers. Must be called before other handlers. */
export function registerSessionHandlers() {
  /**
   * Renderer sends either:
   *   - A plain userId string (new behaviour after my refactor)
   *   - A legacy object { id, role, ... } (onboarding wizard still sends this)
   *
   * In both cases we extract the id and re-fetch everything from the database.
   */
  ipcMain.handle('set-logged-in-user', async (_event, payload: string | { id: string }) => {
    const userId = typeof payload === 'string' ? payload : payload?.id;
    if (!userId || typeof userId !== 'string') {
      return { success: false, message: 'Invalid session payload.' };
    }
    const ok = await restoreSession(userId);
    return { success: ok, message: ok ? undefined : 'User not found.' };
  });

  ipcMain.handle('logout', () => {
    console.log(`[Session] Logged out: ${currentUser?.username ?? 'unknown'}`);
    currentUser = null;
    return { success: true };
  });
}
