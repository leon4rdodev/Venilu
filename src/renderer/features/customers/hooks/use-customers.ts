import { useState, useEffect, useCallback, useMemo } from "react";
import { ipc } from "@lib/ipc";
import { toast } from "sonner";
import { Customer } from "@shared/types/models";

const PAGE_SIZE = 10;

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const result = (await ipc.invoke("get-customers")) as {
        success: boolean;
        data?: Customer[];
        message?: string;
      };
      if (result.success && result.data) {
        setCustomers(result.data);
      } else {
        toast.error("Error al cargar clientes", { description: result.message });
      }
    } catch (error) {
      console.error("Error fetching customers:", error);
      toast.error("Error de conexión", { description: "No se pudieron cargar los clientes" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Reset page on search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const q = searchQuery.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q)) ||
        (c.rnc && c.rnc.toLowerCase().includes(q)) ||
        (c.business_name && c.business_name.toLowerCase().includes(q))
    );
  }, [customers, searchQuery]);

  const totalPages = Math.ceil(filteredCustomers.length / PAGE_SIZE);

  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredCustomers.slice(start, start + PAGE_SIZE);
  }, [filteredCustomers, currentPage]);

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
      await fetchCustomers();
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
        await fetchCustomers();
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
    loading,
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    filteredCustomers,
    paginatedCustomers,
    totalPages,
    PAGE_SIZE,
    handleSave,
    handleDelete,
    fetchCustomers,
  };
}
