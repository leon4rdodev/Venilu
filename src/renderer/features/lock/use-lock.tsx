import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from 'react';
import { User } from '@shared/types/models';
import { useUser } from '@renderer/features/auth';
import { ipc } from '@lib/ipc';

/**
 * Bloqueo rápido de la caja: el cajero se aleja y bloquea la pantalla sin
 * cerrar sesión. Se desbloquea re-autenticando contra `login-request`, que
 * re-emite el token de sesión.
 *
 * La marca vive en sessionStorage para que un recargo de ventana (Ctrl+R)
 * siga bloqueado, pero un cierre de la app no (sessionStorage muere con la
 * ventana). El efecto que la sincroniza limpia la marca al desmontar el
 * provider (logout desmonta el árbol autenticado), así el siguiente login
 * nunca arranca bloqueado.
 */

const LOCK_KEY = 'venilu_locked';

interface UnlockResult {
  success: boolean;
  message?: string;
}

interface LockContextType {
  locked: boolean;
  lock: () => void;
  unlock: (password: string) => Promise<UnlockResult>;
}

const LockContext = createContext<LockContextType | undefined>(undefined);

export const LockProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useUser();
  const [locked, setLocked] = useState<boolean>(() => {
    try {
      return window.sessionStorage.getItem(LOCK_KEY) === '1';
    } catch {
      return false;
    }
  });

  // La marca persistida refleja el estado en memoria. El cleanup corre al
  // desmontar (logout) y la elimina; un recargo de ventana no ejecuta
  // cleanups de React, por lo que la marca sobrevive — exactamente lo deseado.
  useEffect(() => {
    try {
      if (locked) window.sessionStorage.setItem(LOCK_KEY, '1');
      else window.sessionStorage.removeItem(LOCK_KEY);
    } catch {
      /* preferencia solamente */
    }
    return () => {
      try {
        window.sessionStorage.removeItem(LOCK_KEY);
      } catch {
        /* preferencia solamente */
      }
    };
  }, [locked]);

  const lock = useCallback(() => {
    if (!user) return;
    setLocked(true);
  }, [user]);

  const unlock = useCallback(
    async (password: string): Promise<UnlockResult> => {
      if (!user) return { success: false, message: 'No hay una sesión activa.' };
      try {
        const result = (await ipc.invoke('login-request', {
          username: user.username,
          password,
        })) as { success: boolean; message?: string; data?: { user: User; token: string } };

        if (result?.success && result.data) {
          // El backend re-emite el token de sesión — persistirlo igual que el login
          try {
            window.localStorage.setItem('session_token', result.data.token);
          } catch {
            /* la sesión en memoria sigue siendo válida */
          }
          setLocked(false);
          return { success: true };
        }
        return { success: false, message: 'Contraseña incorrecta.' };
      } catch {
        return { success: false, message: 'Ocurrió un error al desbloquear.' };
      }
    },
    [user]
  );

  // Atajo global Ctrl+L para bloquear
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'l') {
        if (!user || locked) return;
        e.preventDefault();
        setLocked(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [user, locked]);

  // Mientras está bloqueado, los atajos globales del POS (F1–F4) no deben
  // actuar: el overlay cubre la UI pero los listeners de teclado siguen vivos.
  // Un listener en fase de captura corta esas teclas — y Enter fuera del
  // overlay — antes de que lleguen a cualquier otro handler.
  useEffect(() => {
    if (!locked) return;
    const blockedKeys = new Set(['F1', 'F2', 'F3', 'F4']);
    const onCapture = (e: KeyboardEvent) => {
      if (blockedKeys.has(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key === 'Enter') {
        const target = e.target as HTMLElement | null;
        // Enter dentro del overlay envía el formulario de desbloqueo; fuera, se corta
        if (!target?.closest?.('[data-lock-screen]')) e.stopPropagation();
      }
    };
    window.addEventListener('keydown', onCapture, true);
    return () => window.removeEventListener('keydown', onCapture, true);
  }, [locked]);

  const value = useMemo(() => ({ locked, lock, unlock }), [locked, lock, unlock]);

  return <LockContext.Provider value={value}>{children}</LockContext.Provider>;
};

export const useLock = () => {
  const context = useContext(LockContext);
  if (context === undefined) {
    throw new Error('useLock must be used within a LockProvider');
  }
  return context;
};
