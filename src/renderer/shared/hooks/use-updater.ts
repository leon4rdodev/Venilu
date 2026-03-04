import { useEffect, useState } from 'react';

export type UpdaterStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'up-to-date'
  | 'error';

interface UpdateInfo {
  version: string;
  releaseNotes?: string | null;
}

interface DownloadProgress {
  percent: number;
  transferred: number;
  total: number;
}

interface UpdaterState {
  status: UpdaterStatus;
  updateInfo: UpdateInfo | null;
  progress: DownloadProgress | null;
  error: string | null;
}

export function useUpdater() {
  const [state, setState] = useState<UpdaterState>({
    status: 'idle',
    updateInfo: null,
    progress: null,
    error: null,
  });

  useEffect(() => {
    const ipc = (window as any).ipcRenderer;
    if (!ipc) return;

    const offChecking = ipc.on('updater:checking', () => {
      setState(s => ({ ...s, status: 'checking' }));
    });

    const offAvailable = ipc.on('updater:update-available', (info: UpdateInfo) => {
      setState(s => ({ ...s, status: 'available', updateInfo: info }));
    });

    const offUpToDate = ipc.on('updater:up-to-date', () => {
      setState(s => ({ ...s, status: 'up-to-date' }));
    });

    const offProgress = ipc.on('updater:download-progress', (progress: DownloadProgress) => {
      setState(s => ({ ...s, status: 'downloading', progress }));
    });

    const offDownloaded = ipc.on('updater:update-downloaded', (info: UpdateInfo) => {
      setState(s => ({ ...s, status: 'downloaded', updateInfo: info, progress: null }));
    });

    const offError = ipc.on('updater:error', (message: string) => {
      setState(s => ({ ...s, status: 'error', error: message }));
    });

    return () => {
      offChecking?.();
      offAvailable?.();
      offUpToDate?.();
      offProgress?.();
      offDownloaded?.();
      offError?.();
    };
  }, []);

  const installNow = () => {
    (window as any).ipcRenderer?.invoke('updater:install-now');
  };

  return { ...state, installNow };
}
