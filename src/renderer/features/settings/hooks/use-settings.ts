import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Setting } from '@shared/types/models';
import { IPCResponse } from '@shared/types/ipc';

// useSettings renamed interface from Settings to Setting for consistency with models.ts
export type Settings = Setting;

/**
 * Cached settings — every consumer shares ONE fetch (previously each instance
 * re-fetched on mount). Updates are optimistic against the cache.
 */
export function useSettings() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      if (!window.ipcRenderer) throw new Error('IPC Renderer not available');
      const result = await window.ipcRenderer.invoke('settings:get') as IPCResponse<Settings>;
      if (!result.success || !result.data) {
        throw new Error(result.message || 'Failed to load settings');
      }
      return result.data;
    },
  });

  const updateSettings = async (newSettings: Partial<Settings>) => {
    // Optimistic: apply to the shared cache immediately (no flicker anywhere)
    queryClient.setQueryData<Settings>(['settings'], (prev) =>
      prev ? { ...prev, ...newSettings } : prev
    );
    try {
      if (!window.ipcRenderer) throw new Error('IPC Renderer not available');
      const result = await window.ipcRenderer.invoke('settings:update', newSettings) as IPCResponse<void>;

      // Re-sync from DB either way (confirms on success, reverts on failure)
      void queryClient.invalidateQueries({ queryKey: ['settings'] });

      if (result.success) return { success: true };
      return { success: false, message: result.message };
    } catch (err) {
      console.error('Error updating settings:', err);
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  };

  return {
    settings: query.data ?? null,
    isLoading: query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
    updateSettings,
    refreshSettings: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  };
}
