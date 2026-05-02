import { createContext, useContext, useState, ReactNode, useMemo, useEffect, useRef, useCallback } from 'react';
import { User } from '@shared/types/models';

interface UserContextType {
  user: User | null;
  sessionReady: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
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
          // Send only the ID — main reloads permissions from DB
          await window.ipcRenderer.invoke('set-logged-in-user', initialUser.id);
          console.log('[useUser] Backend session restored for:', initialUser.username);
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
        window.localStorage.setItem('user', JSON.stringify(user));
        // Send ONLY the user ID — main process reloads permissions from DB
        if (window.ipcRenderer) {
          await window.ipcRenderer.invoke('set-logged-in-user', user.id);
        }
      } else {
        window.localStorage.removeItem('user');
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
