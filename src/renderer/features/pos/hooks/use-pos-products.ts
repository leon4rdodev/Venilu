import { useState, useCallback, useEffect, useRef } from 'react';
import { Product } from '@shared/types/models';
import { IPCResponse } from '@shared/types/ipc';
import type { POSPagination } from '../types';

const PAGE_SIZE = 40;

/**
 * Server-driven POS product catalog.
 *
 * Search and category filtering happen in the DATABASE (debounced), so the POS
 * sees the whole catalog — not just the first page. `loadMore` appends the next
 * page for large result sets.
 */
export function usePOSProducts(search: string, categoryId: string) {
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<POSPagination>({
    currentPage: 1,
    pageSize: PAGE_SIZE,
    totalItems: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  // Guards against out-of-order responses (fast typing / slow queries)
  const requestIdRef = useRef(0);

  const fetchPage = useCallback(async (page: number, append: boolean) => {
    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    try {
      if (!window.ipcRenderer) throw new Error('IPC Renderer not available');

      const result = await window.ipcRenderer.invoke('get-products-for-pos', {
        page,
        pageSize: PAGE_SIZE,
        search,
        category: categoryId || 'all',
        sortBy: 'name',
        sortOrder: 'ASC',
      }) as IPCResponse<{ products: Product[]; pagination: POSPagination }>;

      if (requestId !== requestIdRef.current) return; // stale response — drop

      if (result.success && result.data) {
        const incoming = result.data.products;
        setProducts(prev => (append ? [...prev, ...incoming] : incoming));
        setPagination(result.data.pagination);
      }
    } catch (err) {
      console.error('Error loading POS products:', err);
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, [search, categoryId]);

  // Debounced server-side search/filter
  useEffect(() => {
    const timer = setTimeout(() => { void fetchPage(1, false); }, 250);
    return () => clearTimeout(timer);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (pagination.hasNextPage && !isLoading) {
      void fetchPage(pagination.currentPage + 1, true);
    }
  }, [pagination.hasNextPage, pagination.currentPage, isLoading, fetchPage]);

  /** Re-fetches the first page with current filters (e.g. after a sale updates stock). */
  const refresh = useCallback(() => { void fetchPage(1, false); }, [fetchPage]);

  return { products, pagination, isLoading, loadMore, refresh };
}
