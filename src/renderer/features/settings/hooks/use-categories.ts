import { useState, useEffect, useCallback } from 'react';
import { Category } from '@shared/types/models';
import { IPCResponse } from '@shared/types/ipc';

export function useCategories(includeCount = false) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (!window.ipcRenderer) {
        throw new Error('IPC Renderer not available');
      }

      const action = includeCount ? 'get-categories-with-count' : 'get-categories';
      const result = await window.ipcRenderer.invoke(action) as IPCResponse<Category[]>;

      if (result.success && result.data) {
        setCategories(result.data);
      } else {
        setError(result.message || 'Failed to load categories');
      }
    } catch (err) {
      console.error('Error loading categories:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [includeCount]);

  const createCategory = useCallback(async (name: string) => {
    try {
      if (!window.ipcRenderer) {
        throw new Error('IPC Renderer not available');
      }

      const result = await window.ipcRenderer.invoke('create-category', name) as IPCResponse<Category>;

      if (result.success) {
        await loadCategories(); // Reload categories
        return { success: true };
      } else {
        return { success: false, message: result.message };
      }
    } catch (err) {
      console.error('Error creating category:', err);
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  }, [loadCategories]);

  const updateCategory = useCallback(async (id: string, name: string) => {
    try {
      if (!window.ipcRenderer) {
        throw new Error('IPC Renderer not available');
      }

      const result = await window.ipcRenderer.invoke('update-category', { id, name }) as IPCResponse<void>;

      if (result.success) {
        await loadCategories(); // Reload categories
        return { success: true };
      } else {
        return { success: false, message: result.message };
      }
    } catch (err) {
      console.error('Error updating category:', err);
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  }, [loadCategories]);

  const deleteCategory = useCallback(async (id: string) => {
    try {
      if (!window.ipcRenderer) {
        throw new Error('IPC Renderer not available');
      }

      const result = await window.ipcRenderer.invoke('delete-category', id) as IPCResponse<void>;

      if (result.success) {
        await loadCategories(); // Reload categories
        return { success: true };
      } else {
        return { success: false, message: result.message };
      }
    } catch (err) {
      console.error('Error deleting category:', err);
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  }, [loadCategories]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  return {
    categories,
    isLoading,
    error,
    loadCategories,
    createCategory,
    updateCategory,
    deleteCategory
  };
}
