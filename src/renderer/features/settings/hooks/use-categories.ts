import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Category } from '@shared/types/models';
import { IPCResponse } from '@shared/types/ipc';

/**
 * Cached category list. All instances across the app (POS, inventory, dialogs)
 * now share ONE fetch instead of each firing its own IPC on mount.
 */
export function useCategories(includeCount = false) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['categories', includeCount],
    queryFn: async () => {
      if (!window.ipcRenderer) throw new Error('IPC Renderer not available');
      const action = includeCount ? 'get-categories-with-count' : 'get-categories';
      const result = await window.ipcRenderer.invoke(action) as IPCResponse<Category[]>;
      if (!result.success || !result.data) {
        throw new Error(result.message || 'Failed to load categories');
      }
      return result.data;
    },
  });

  /** Invalidates BOTH variants (with/without counts). Returns a promise for callers that await it. */
  const loadCategories = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
    [queryClient]
  );

  const createCategory = useCallback(async (name: string) => {
    try {
      if (!window.ipcRenderer) throw new Error('IPC Renderer not available');
      const result = await window.ipcRenderer.invoke('create-category', name) as IPCResponse<Category>;
      if (result.success) {
        await queryClient.invalidateQueries({ queryKey: ['categories'] });
        return { success: true };
      }
      return { success: false, message: result.message };
    } catch (err) {
      console.error('Error creating category:', err);
      return { success: false, message: err instanceof Error ? err.message : 'Unknown error' };
    }
  }, [queryClient]);

  const updateCategory = useCallback(async (id: string, name: string) => {
    try {
      if (!window.ipcRenderer) throw new Error('IPC Renderer not available');
      const result = await window.ipcRenderer.invoke('update-category', { id, name }) as IPCResponse<void>;
      if (result.success) {
        await queryClient.invalidateQueries({ queryKey: ['categories'] });
        return { success: true };
      }
      return { success: false, message: result.message };
    } catch (err) {
      console.error('Error updating category:', err);
      return { success: false, message: err instanceof Error ? err.message : 'Unknown error' };
    }
  }, [queryClient]);

  const deleteCategory = useCallback(async (id: string) => {
    try {
      if (!window.ipcRenderer) throw new Error('IPC Renderer not available');
      const result = await window.ipcRenderer.invoke('delete-category', id) as IPCResponse<void>;
      if (result.success) {
        await queryClient.invalidateQueries({ queryKey: ['categories'] });
        return { success: true };
      }
      return { success: false, message: result.message };
    } catch (err) {
      console.error('Error deleting category:', err);
      return { success: false, message: err instanceof Error ? err.message : 'Unknown error' };
    }
  }, [queryClient]);

  return {
    categories: query.data ?? [],
    isLoading: query.isPending,
    error: query.error instanceof Error ? query.error.message : null,
    loadCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  };
}
