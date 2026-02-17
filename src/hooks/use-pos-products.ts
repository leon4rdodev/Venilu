import { useState, useCallback, useEffect } from 'react';

export interface POSProduct {
  id: number;
  name: string;
  category: string;
  sale_price: number;
  stock: number;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
}

export interface POSPagination {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export function usePOSProducts() {
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [pagination, setPagination] = useState<POSPagination>({
    currentPage: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false
  });
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadProducts = useCallback(async (params: {
    page?: number;
    pageSize?: number;
    search?: string;
    category?: string;
    append?: boolean; // For infinite scroll
  } = {}) => {
    const {
      page = 1,
      pageSize = 20,
      search = '',
      category = 'all',
      append = false
    } = params;

    setIsLoading(true);
    setHasError(false);
    setErrorMessage('');

    try {
      if (!window.ipcRenderer) {
        throw new Error('IPC Renderer not available');
      }

      const result = await window.ipcRenderer.invoke('get-products-for-pos', {
        page,
        pageSize,
        search,
        category,
        sortBy: 'name',
        sortOrder: 'ASC'
      }) as {
        success: boolean;
        products?: POSProduct[];
        pagination?: POSPagination;
        message?: string;
      };

      if (result.success && result.products && result.pagination) {
        if (append) {
          // Append for infinite scroll
          setProducts(prev => [...prev, ...result.products!]);
        } else {
          // Replace for search/filter
          setProducts(result.products);
        }
        setPagination(result.pagination);
      } else {
        setHasError(true);
        setErrorMessage(result.message || 'Error al cargar productos');
      }
    } catch (err) {
      console.error('Error loading POS products:', err);
      setHasError(true);
      setErrorMessage(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!pagination.hasNextPage || isLoading) return;
    
    await loadProducts({
      page: pagination.currentPage + 1,
      pageSize: pagination.pageSize,
      append: true
    });
  }, [pagination, isLoading, loadProducts]);

  const refresh = useCallback(async () => {
    await loadProducts({ page: 1 });
  }, [loadProducts]);

  // Initial load
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  return {
    products,
    pagination,
    isLoading,
    hasError,
    errorMessage,
    loadProducts,
    loadMore,
    refresh
  };
}
