/**
 * Server-side session management for the main process.
 * This is the single source of truth for the authenticated user.
 * The frontend cannot forge this data — it is set only after a
 * successful login-request that queries the real database.
 */

import { ipcMain } from 'electron';

interface SessionUser {
    id: string;
    role: 'admin' | 'employee';
    username: string;
    name: string;
}

let currentUser: SessionUser | null = null;

/** Returns the current session user or null. */
export function getSessionUser(): SessionUser | null {
    return currentUser;
}

/**
 * Asserts that there is an authenticated user with the given role.
 * Throws an error (which becomes { success: false }) if the check fails.
 */
export function requireRole(role: 'admin' | 'employee'): SessionUser {
    if (!currentUser) {
        throw new Error('Unauthorized: no active session.');
    }
    if (role === 'admin' && currentUser.role !== 'admin') {
        throw new Error('Forbidden: admin access required.');
    }
    return currentUser;
}

/** Asserts that any authenticated user is present. */
export function requireAuth(): SessionUser {
    if (!currentUser) {
        throw new Error('Unauthorized: no active session.');
    }
    return currentUser;
}

/** Registers the session IPC handlers (set-logged-in-user, logout). */
export function registerSessionHandlers() {
    ipcMain.handle('set-logged-in-user', (_event, user: SessionUser) => {
        if (user && typeof user.id === 'string' && user.id.length > 0) {
            currentUser = {
                id: user.id,
                role: user.role,
                username: user.username,
                name: user.name,
            };
            console.log(`[Session] User set: ${user.username} (${user.role})`);
        }
        return { success: true };
    });

    ipcMain.handle('logout', () => {
        console.log(`[Session] User logged out: ${currentUser?.username ?? 'unknown'}`);
        currentUser = null;
        return { success: true };
    });
}
