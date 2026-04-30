import { createContext, useContext, useState, ReactNode, useMemo, useEffect } from 'react';
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

  useEffect(() => {
    const restoreBackendSession = async () => {
      if (user && window.ipcRenderer) {
        try {
          // Send only the ID — main reloads permissions from DB
          await window.ipcRenderer.invoke('set-logged-in-user', user.id);
          console.log('[useUser] Backend session restored for:', user.username);
        } catch (error) {
          console.error('[useUser] Error restoring backend session:', error);
        }
      }
      setSessionReady(true);
    };
    restoreBackendSession();
  }, []); // Only run on mount

  const setUser = (user: User | null) => {
    try {
      if (user) {
        window.localStorage.setItem('user', JSON.stringify(user));
        // Send ONLY the user ID — main process reloads permissions from DB
        if (window.ipcRenderer) {
          window.ipcRenderer.invoke('set-logged-in-user', user.id).catch((error: Error) => {
            console.error('[useUser] Error setting backend session:', error);
          });
        }
      } else {
        window.localStorage.removeItem('user');
      }
      setUserState(user);
    } catch (error) {
      console.error('[useUser] Error saving user to localStorage', error);
    }
  };

  const logout = async () => {
    // Call backend to clear session
    try {
      if (window.ipcRenderer) {
        await window.ipcRenderer.invoke('logout');
      }
    } catch (error) {
      console.error('Error calling backend logout:', error);
    }

    // Clear user state - this will trigger navigation to /login via App.tsx
    setUser(null);
  };

  const value = useMemo(() => ({ user, sessionReady, setUser, logout }), [user, sessionReady]);

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
