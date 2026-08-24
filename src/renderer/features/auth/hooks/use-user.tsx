import { createContext, useContext, useState, ReactNode, useMemo, useEffect, useRef, useCallback } from 'react';
import { User } from '@shared/types/models';

interface UserContextType {
  user: User | null;
  sessionReady: boolean;
  setUser: (user: User | null) => Promise<void>;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUserState] = useState<User | null>(() => {
    try {
      const item = window.localStorage.getItem('user');
      if (!item) return null;
      const parsed = JSON.parse(item);
      // Validate it's a real User object (not a wrapped IPC response)
      if (!parsed || typeof parsed.id !== 'string' || parsed.id === '') {
        window.localStorage.removeItem('user');
        return null;
      }
      return parsed as User;
    } catch (error) {
      console.error("Error reading user from localStorage", error);
      return null;
    }
  });
  // True only after the main-process session has been confirmed (or if there is no user to restore)
  const [sessionReady, setSessionReady] = useState(false);

  // Capture the user value that existed at mount time (restored from localStorage).
  // Using a ref avoids adding `user` to the effect deps, which would cause the
  // session restoration IPC call to re-fire on every login/logout — not desired.
  const initialUserRef = useRef(user);

  useEffect(() => {
    const restoreBackendSession = async () => {
      const initialUser = initialUserRef.current;
      if (initialUser && window.ipcRenderer) {
        try {
          // Restore with the session token issued at login — main re-fetches
          // the user and permissions from the DB.
          const token = window.localStorage.getItem('session_token');
          const result = await window.ipcRenderer.invoke('session:restore', {
            userId: initialUser.id,
            token,
          }) as { success: boolean; message?: string };

          if (result?.success) {
            console.log('[useUser] Backend session restored for:', initialUser.username);
          } else {
            // Expired or invalid token — force a fresh login
            console.warn('[useUser] Session restore rejected:', result?.message);
            window.localStorage.removeItem('user');
            window.localStorage.removeItem('session_token');
            setUserState(null);
          }
        } catch (error) {
          console.error('[useUser] Error restoring backend session:', error);
        }
      }
      setSessionReady(true);
    };
    restoreBackendSession();
  }, []); // Intentionally runs once on mount — initialUserRef is stable

  const setUser = useCallback(async (user: User | null) => {
    try {
      setSessionReady(false);
      if (user) {
        // The main-process session is established by login-request /
        // session:restore — here we only persist the renderer copy.
        window.localStorage.setItem('user', JSON.stringify(user));
      } else {
        window.localStorage.removeItem('user');
        window.localStorage.removeItem('session_token');
        if (window.ipcRenderer) {
          await window.ipcRenderer.invoke('logout');
        }
      }
      setUserState(user);
    } catch (error) {
      console.error('[useUser] Error setting backend session:', error);
    } finally {
      setSessionReady(true);
    }
  }, []);

  const logout = useCallback(async () => {
    await setUser(null);
  }, [setUser]);

  const value = useMemo(() => ({ user, sessionReady, setUser, logout }), [user, sessionReady, setUser, logout]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};
