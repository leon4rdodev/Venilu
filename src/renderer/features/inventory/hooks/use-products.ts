import { useState, useEffect, useCallback, useMemo } from "react";
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

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationData>({
    currentPage: 1,
    pageSize: 50,
    totalItems: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  const { categories: categoryList, loadCategories } = useCategories(true);

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchProducts = useCallback(
    async (
      page: number = pagination.currentPage,
      pageSize: number = pagination.pageSize,
      search: string = debouncedSearch,
      category: string = selectedCategory
    ) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = (await ipc.invoke("get-products", {
          page,
          pageSize,
          search,
          category,
          sortBy: "name",
          sortOrder: "ASC",
        })) as {
          success: boolean;
          products?: Product[];
          pagination?: PaginationData;
          message?: string;
        };

        if (result.success && result.products && result.pagination) {
          setProducts(result.products);
          setPagination(result.pagination);
        } else {
          setError(result.message || "Error al cargar productos");
          toast.error("Error al cargar productos", { description: result.message });
        }
      } catch (err) {
        console.error("Error fetching products:", err);
        setError("Error de conexión");
        toast.error("Error de conexión", { description: "No se pudieron cargar los productos" });
      } finally {
        setIsLoading(false);
      }
    },
    [pagination.currentPage, pagination.pageSize, debouncedSearch, selectedCategory]
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    fetchProducts(1);
  }, [debouncedSearch, selectedCategory]);

  const handleSave = async (productData: Product, editingProduct: Product | null) => {
    setIsSaving(true);
    try {
      let result: any;
      if (editingProduct) {
        const productId = productData.id || editingProduct.id;
        if (!productId) throw new Error("No se pudo identificar el ID del producto");
        result = await ipc.invoke("update-product", { productId, productData });
      } else {
        result = await ipc.invoke("create-product", productData);
      }

      if (result?.success) {
        toast.success(editingProduct ? "Producto actualizado" : "Producto creado");
        await fetchProducts();
        await loadCategories();
        window.dispatchEvent(new CustomEvent("inventory-updated"));
        return true;
      } else {
        throw new Error(result?.message || "Error en la operación");
      }
    } catch (error: any) {
      toast.error("Error al guardar producto", {
        description: error.message || "Ha ocurrido un error inesperado",
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (productId: string) => {
    setIsSaving(true);
    try {
      await ipc.invoke("delete-product", productId);
      toast.success("Producto eliminado");
      await fetchProducts();
      await loadCategories();
      window.dispatchEvent(new CustomEvent("inventory-updated"));
      return true;
    } catch {
      toast.error("Error al eliminar producto");
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handlePageChange = useCallback(
    (page: number) => fetchProducts(page, pagination.pageSize, debouncedSearch, selectedCategory),
    [fetchProducts, pagination.pageSize, debouncedSearch, selectedCategory]
  );

  const handlePageSizeChange = useCallback(
    (pageSize: number) => fetchProducts(1, pageSize, debouncedSearch, selectedCategory),
    [fetchProducts, debouncedSearch, selectedCategory]
  );

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
    isLoading,
    isSaving,
    error,
    pagination,
    categories,
    categoryList,
    loadCategories,
    fetchProducts,
    handleSave,
    handleDelete,
    handlePageChange,
    handlePageSizeChange,
  };
}
