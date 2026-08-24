import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { ipc } from "@lib/ipc";
import { toast } from "sonner";
import { Customer } from "@shared/types/models";
import type {
  CustomerFilter,
  CustomerSortBy,
  CustomerListItem,
  CustomerListResponse,
} from "../types";

const PAGE_SIZE = 10;

const EMPTY_PAGE = {
  items: [] as CustomerListItem[],
  total: 0,
  page: 1,
  pageSize: PAGE_SIZE,
  totalPages: 1,
};

/**
 * Mature server-driven customer list: pagination, search, filters and sorting
 * all resolve in the DATABASE (with purchase aggregates per row), cached with
 * keepPreviousData so filter changes never blank the table.
 */
export function useCustomers() {
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<CustomerFilter>("all");
  const [sortBy, setSortBy] = useState<CustomerSortBy>("name");
  const [sortOrder, setSortOrder] = useState<"ASC" | "DESC">("ASC");
  const [currentPage, setCurrentPage] = useState(1);

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filter, sortBy, sortOrder]);

  const query = useQuery({
    queryKey: [
      "customers-list",
      { page: currentPage, pageSize: PAGE_SIZE, search: debouncedSearch, filter, sortBy, sortOrder },
    ],
    queryFn: async () => {
      const result = (await ipc.invoke("list-customers", {
        page: currentPage,
        pageSize: PAGE_SIZE,
        search: debouncedSearch,
        filter,
        sortBy,
        sortOrder,
      })) as CustomerListResponse;
      if (!result.success || !result.data) {
        throw new Error(result.message || "No se pudieron cargar los clientes");
      }
      return result.data;
    },
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (query.error) {
      toast.error("Error al cargar clientes", {
        description: query.error instanceof Error ? query.error.message : undefined,
      });
    }
  }, [query.error]);

  const data = query.data ?? EMPTY_PAGE;
  const customers = useMemo(() => data.items, [data.items]);

  const fetchCustomers = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["customers-list"] }),
    [queryClient]
  );

  const handleSave = async (customerData: Partial<Customer>, editingCustomer: Customer | null) => {
    try {
      if (editingCustomer) {
        const result = (await ipc.invoke("update-customer", {
          customerId: editingCustomer.id,
          customerData,
        })) as { success: boolean; message?: string };
        if (result.success) {
          toast.success("Cliente actualizado");
        } else {
          toast.error("Error al actualizar", { description: result.message });
          return false;
        }
      } else {
        const result = (await ipc.invoke("create-customer", customerData)) as {
          success: boolean;
          message?: string;
        };
        if (result.success) {
          toast.success("Cliente creado");
        } else {
          toast.error("Error al crear", { description: result.message });
          return false;
        }
      }
      // CacheBridge invalidates customers-list + customer-stats via this event
      window.dispatchEvent(new Event("customers-updated"));
      return true;
    } catch (error: unknown) {
      toast.error("Error", { description: error instanceof Error ? error.message : "Error inesperado" });
      return false;
    }
  };

  const handleDelete = async (customer: Customer) => {
    try {
      const result = (await ipc.invoke("delete-customer", customer.id)) as {
        success: boolean;
        message?: string;
      };
      if (result.success) {
        toast.success("Cliente eliminado");
        window.dispatchEvent(new Event("customers-updated"));
        return true;
      } else {
        toast.error("Error al eliminar", { description: result.message });
        return false;
      }
    } catch (error: unknown) {
      toast.error("Error", { description: error instanceof Error ? error.message : "Error inesperado" });
      return false;
    }
  };

  return {
    loading: query.isPending,
    customers,
    total: data.total,
    totalPages: data.totalPages,
    searchQuery,
    setSearchQuery,
    filter,
    setFilter,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    currentPage,
    setCurrentPage,
    PAGE_SIZE,
    handleSave,
    handleDelete,
    fetchCustomers,
  };
}
