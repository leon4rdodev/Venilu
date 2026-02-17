import { useState, useEffect, useCallback } from 'react';

export interface Category {
  id: number;
  name: string;
  created_at: string;
  product_count?: number;
}

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

      const handler = includeCount ? 'get-categories-with-count' : 'get-categories';
      const result = await window.ipcRenderer.invoke(handler) as {
        success: boolean;
        categories?: Category[];
        message?: string;
      };

      if (result.success && result.categories) {
        setCategories(result.categories);
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

      const result = await window.ipcRenderer.invoke('create-category', name) as {
        success: boolean;
        message?: string;
        category?: Category;
      };

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

  const updateCategory = useCallback(async (id: number, name: string) => {
    try {
      if (!window.ipcRenderer) {
        throw new Error('IPC Renderer not available');
      }

      const result = await window.ipcRenderer.invoke('update-category', { id, name }) as {
        success: boolean;
        message?: string;
      };

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

  const deleteCategory = useCallback(async (id: number) => {
    try {
      if (!window.ipcRenderer) {
        throw new Error('IPC Renderer not available');
      }

      const result = await window.ipcRenderer.invoke('delete-category', id) as {
        success: boolean;
        message?: string;
      };

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
