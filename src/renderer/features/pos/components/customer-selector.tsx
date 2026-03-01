import { useState, useEffect, useRef, useCallback } from "react";
import { User2, Search, X, Plus, AlertCircle } from "lucide-react";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { ipc } from "@lib/ipc";
import { Customer } from "@shared/types/models";
import { formatCurrency } from "@lib/currency";
import { cn } from "@lib/utils";

interface CustomerSelectorProps {
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer | null) => void;
}

export function CustomerSelector({ selectedCustomer, onSelectCustomer }: CustomerSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchCustomers = useCallback(async (query: string = "") => {
    setLoading(true);
    try {
      const channel = query.trim() ? "search-customers" : "get-customers";
      const args = query.trim() ? query.trim() : undefined;
      const result = (await ipc.invoke(channel, args)) as {
        success: boolean;
        data?: Customer[];
      };
      if (result.success && result.data) {
        setCustomers(result.data);
      }
    } catch (error) {
      console.error("Error fetching customers:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchCustomers();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, fetchCustomers]);

  useEffect(() => {
    if (!isOpen) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchCustomers(search);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, isOpen, fetchCustomers]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const handleSelect = (customer: Customer) => {
    onSelectCustomer(customer);
    setIsOpen(false);
    setSearch("");
  };

  const handleClear = () => {
    onSelectCustomer(null);
    setIsOpen(false);
    setSearch("");
  };

  if (selectedCustomer) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-primary/5 border-primary/20">
        <User2 className="h-3.5 w-3.5 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{selectedCustomer.name}</p>
          {Number(selectedCustomer.balance) > 0 && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
              <AlertCircle className="h-2.5 w-2.5" />
              Deuda: {formatCurrency(Number(selectedCustomer.balance))}
            </p>
          )}
        </div>
        <button
          onClick={handleClear}
          className="p-0.5 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 text-xs text-muted-foreground gap-1.5 hover:text-foreground"
        onClick={() => setIsOpen(!isOpen)}
      >
        <User2 className="h-3.5 w-3.5" />
        Cliente
        <Plus className="h-3 w-3" />
      </Button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-72 rounded-lg border bg-popover shadow-lg z-50 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o teléfono..."
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-48 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : customers.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                {search ? "No se encontraron clientes" : "No hay clientes registrados"}
              </div>
            ) : (
              customers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => handleSelect(customer)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/50 transition-colors text-xs",
                    "border-b last:border-b-0 border-border/50"
                  )}
                >
                  <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{customer.name}</p>
                    {customer.phone && (
                      <p className="text-[10px] text-muted-foreground truncate">{customer.phone}</p>
                    )}
                  </div>
                  {Number(customer.balance) > 0 && (
                    <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 whitespace-nowrap">
                      Deuda: {formatCurrency(Number(customer.balance))}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
