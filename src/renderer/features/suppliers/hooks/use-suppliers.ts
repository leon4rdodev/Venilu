import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { ipc } from "@lib/ipc";
import { toast } from "sonner";
import { Supplier } from "@shared/types/models";
import type { SupplierFilter, SupplierSortBy, SupplierListItem, Paged, IpcResult } from "../types";

const PAGE_SIZE = 10;

const EMPTY_PAGE: Paged<SupplierListItem> = { items: [], total: 0, page: 1, pageSize: PAGE_SIZE, totalPages: 1 };

/** Lista de suplidores paginada/filtrada en la base de datos (misma mecánica que Clientes). */
export function useSuppliers() {
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<SupplierFilter>("all");
  const [sortBy, setSortBy] = useState<SupplierSortBy>("name");
  const [sortOrder, setSortOrder] = useState<"ASC" | "DESC">("ASC");

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filterKey = JSON.stringify([debouncedSearch, filter, sortBy, sortOrder]);
  const [paging, setPaging] = useState({ key: filterKey, page: 1 });
  if (paging.key !== filterKey) setPaging({ key: filterKey, page: 1 });
  const currentPage = paging.key === filterKey ? paging.page : 1;
  const setCurrentPage = (page: number) => setPaging({ key: filterKey, page });

  const query = useQuery({
    queryKey: ["suppliers-list", { page: currentPage, pageSize: PAGE_SIZE, search: debouncedSearch, filter, sortBy, sortOrder }],
    queryFn: async () => {
      const result = (await ipc.invoke("suppliers:list", {
        page: currentPage, pageSize: PAGE_SIZE, search: debouncedSearch, filter, sortBy, sortOrder,
      })) as IpcResult<Paged<SupplierListItem>>;
      if (!result.success || !result.data) throw new Error(result.message || "No se pudieron cargar los suplidores");
      return result.data;
    },
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (query.error) {
      toast.error("Error al cargar suplidores", { description: query.error instanceof Error ? query.error.message : undefined });
    }
  }, [query.error]);

  const data = query.data ?? EMPTY_PAGE;

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["suppliers-list"] });
    void queryClient.invalidateQueries({ queryKey: ["supplier-stats"] });
  }, [queryClient]);

  const handleSave = async (payload: Partial<Supplier>, editing: Supplier | null): Promise<boolean> => {
    try {
      const result = editing
        ? ((await ipc.invoke("suppliers:update", { supplierId: editing.id, data: payload })) as IpcResult<Supplier>)
        : ((await ipc.invoke("suppliers:create", payload)) as IpcResult<Supplier>);
      if (!result.success) {
        toast.error(editing ? "Error al actualizar" : "Error al crear", { description: result.message });
        return false;
      }
      toast.success(editing ? "Suplidor actualizado" : "Suplidor creado");
      window.dispatchEvent(new Event("suppliers-updated"));
      return true;
    } catch (error: unknown) {
      toast.error("Error", { description: error instanceof Error ? error.message : "Error inesperado" });
      return false;
    }
  };

  const handleDelete = async (supplier: Supplier): Promise<boolean> => {
    try {
      const result = (await ipc.invoke("suppliers:delete", supplier.id)) as IpcResult<{ deleted: boolean; deactivated: boolean }>;
      if (!result.success) {
        toast.error("Error al eliminar", { description: result.message });
        return false;
      }
      if (result.data?.deactivated) {
        toast.success("Suplidor desactivado", { description: "Tiene compras registradas, así que se conserva su historial." });
      } else {
        toast.success("Suplidor eliminado");
      }
      window.dispatchEvent(new Event("suppliers-updated"));
      return true;
    } catch (error: unknown) {
      toast.error("Error", { description: error instanceof Error ? error.message : "Error inesperado" });
      return false;
    }
  };

  return {
    loading: query.isPending,
    suppliers: data.items,
    total: data.total,
    totalPages: data.totalPages,
    searchQuery, setSearchQuery,
    filter, setFilter,
    sortBy, setSortBy,
    sortOrder, setSortOrder,
    currentPage, setCurrentPage,
    PAGE_SIZE,
    handleSave,
    handleDelete,
    refresh,
  };
}
