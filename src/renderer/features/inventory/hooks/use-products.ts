import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { ipc } from "@lib/ipc";
import { toast } from "sonner";
import { Product } from "@shared/types/models";
import { useCategories } from "@renderer/features/settings";

type PaginationData = {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type StockFilter = "all" | "low" | "out";
export type SortOrder = "ASC" | "DESC";
export type ViewMode = "grid" | "table";

const VIEW_MODE_KEY = "venilu_inventory_view";

const DEFAULT_PAGINATION: PaginationData = {
  currentPage: 1,
  pageSize: 12,
  totalItems: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};

function readViewMode(): ViewMode {
  try {
    const stored = window.localStorage.getItem(VIEW_MODE_KEY);
    return stored === "table" ? "table" : "grid";
  } catch {
    return "grid";
  }
}

export function useProducts() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("ASC");
  const [viewMode, setViewModeState] = useState<ViewMode>(readViewMode);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [isSaving, setIsSaving] = useState(false);

  const { categories: categoryList, loadCategories } = useCategories(true);

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    try {
      window.localStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      /* per-view convenience only */
    }
  }, []);

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset to page 1 when any filter/sort changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedCategory, stockFilter, sortBy, sortOrder]);

  // Cached, keyed by every filter — keepPreviousData means changing filters or
  // pages NEVER blanks the list: the previous result stays visible while the
  // new one loads in the background.
  const query = useQuery({
    queryKey: [
      "products",
      { page, pageSize, search: debouncedSearch, category: selectedCategory, stockFilter, sortBy, sortOrder },
    ],
    queryFn: async () => {
      const result = (await ipc.invoke("get-products", {
        page,
        pageSize,
        search: debouncedSearch,
        category: selectedCategory,
        sortBy,
        sortOrder,
        stockFilter,
      })) as {
        success: boolean;
        data?: { products: Product[]; pagination: PaginationData };
        message?: string;
      };
      if (!result.success || !result.data) {
        throw new Error(result.message || "Error al cargar productos");
      }
      return result.data;
    },
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (query.error) {
      toast.error("Error al cargar productos", {
        description: query.error instanceof Error ? query.error.message : undefined,
      });
    }
  }, [query.error]);

  const products = useMemo(() => query.data?.products ?? [], [query.data]);
  const pagination = query.data?.pagination ?? DEFAULT_PAGINATION;

  /** Refetches the product list (all cached filter combinations). */
  const fetchProducts = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["products"] }),
    [queryClient]
  );

  const handleSave = async (productData: Product, editingProduct: Product | null) => {
    setIsSaving(true);
    try {
      let result: { success: boolean; message?: string };
      if (editingProduct) {
        const productId = productData.id || editingProduct.id;
        if (!productId) throw new Error("No se pudo identificar el ID del producto");
        result = await ipc.invoke("update-product", { productId, productData }) as { success: boolean; message?: string };
      } else {
        result = await ipc.invoke("create-product", productData) as { success: boolean; message?: string };
      }

      if (result?.success) {
        toast.success(editingProduct ? "Producto actualizado" : "Producto creado");
        // CacheBridge invalidates products/inventory-stats/low-stock via this event
        window.dispatchEvent(new CustomEvent("inventory-updated"));
        void loadCategories();
        return true;
      } else {
        throw new Error(result?.message || "Error en la operación");
      }
    } catch (error: unknown) {
      toast.error("Error al guardar producto", {
        description: (error as Error).message || "Ha ocurrido un error inesperado",
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  /** Quick stock adjustment — server enforces inventory:adjust_stock. */
  const handleAdjustStock = async (productId: string, newStock: number): Promise<boolean> => {
    setIsSaving(true);
    try {
      const result = await ipc.invoke("update-product", {
        productId,
        productData: { stock: newStock },
      }) as { success: boolean; message?: string };

      if (!result?.success) {
        toast.error("Error al ajustar stock", { description: result?.message });
        return false;
      }
      toast.success("Stock actualizado");
      window.dispatchEvent(new CustomEvent("inventory-updated"));
      return true;
    } catch (err) {
      toast.error("Error al ajustar stock", { description: (err as Error).message });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (productId: string) => {
    setIsSaving(true);
    try {
      const result = await ipc.invoke("delete-product", productId) as { success: boolean; message?: string };
      if (!result?.success) {
        toast.error("Error al eliminar producto", { description: result?.message });
        return false;
      }
      toast.success("Producto eliminado");
      window.dispatchEvent(new CustomEvent("inventory-updated"));
      void loadCategories();
      return true;
    } catch {
      toast.error("Error al eliminar producto");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handlePageChange = useCallback((newPage: number) => setPage(newPage), []);

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1);
  }, []);

  const categories = useMemo(
    () => [
      { id: "all", name: "Todas las categorías" },
      ...categoryList.map((c) => ({ id: c.id.toString(), name: c.name })),
    ],
    [categoryList]
  );

  return {
    products,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    stockFilter,
    setStockFilter,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    viewMode,
    setViewMode,
    isLoading: query.isPending,
    isSaving,
    error: query.error instanceof Error ? query.error.message : null,
    pagination,
    categories,
    categoryList,
    loadCategories,
    fetchProducts,
    handleSave,
    handleAdjustStock,
    handleDelete,
    handlePageChange,
    handlePageSizeChange,
  };
}
