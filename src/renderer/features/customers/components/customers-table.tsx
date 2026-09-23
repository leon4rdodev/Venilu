import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@components/ui/table";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import {
  Plus, Search, Pencil, Trash2, Users, SearchX,
  HandCoins, Eye, X, ArrowUpNarrowWide, ArrowDownWideNarrow, Download, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { WidgetHeader } from "@renderer/shared/components/widget-header";
import { TablePagination } from "@renderer/shared/components/table-pagination";
import { CustomerDialog } from "./customer-dialog";
import { CustomersStats } from "./customers-stats";
import { PayDebtDialog } from "./pay-debt-dialog";
import { CustomerProfileDialog } from "./customer-profile-dialog";
import { DeleteConfirmDialog } from "@renderer/shared/components/delete-confirm-dialog";
import { TableSkeletonRows } from "@renderer/shared/components/table-skeleton";
import { EmptyStateRow } from "@renderer/shared/components/empty-state";
import { useCustomers } from "../hooks/use-customers";
import { useShift } from "@renderer/features/pos/hooks/use-shift";
import { usePermissions } from "@renderer/features/auth/hooks/use-permission";
import { Customer } from "@shared/types/models";
import type { CustomerFilter, CustomerSortBy } from "../types";
import { formatCurrency } from "@lib/currency";
import { formatPhone, formatDateTime } from "@lib/formatters";
import { cn } from "@lib/utils";

const FILTERS: { value: CustomerFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "debtors", label: "Con deuda" },
  { value: "credit", label: "Con crédito" },
  { value: "inactive", label: "Inactivos 30d" },
];

const SORT_OPTIONS: { value: CustomerSortBy; label: string }[] = [
  { value: "name", label: "Nombre" },
  { value: "total_spent", label: "Más gastado" },
  { value: "purchases_count", label: "Más compras" },
  { value: "last_purchase_at", label: "Última compra" },
  { value: "balance", label: "Deuda" },
  { value: "created_at", label: "Más recientes" },
];

/** "Hoy" / "Ayer" / "Hace Nd" / short date — mature-POS relative recency. */
// Accepts Date too: IPC structured-clone delivers entity dates as Date objects.
function formatRecency(value: string | Date | null): string {
  if (!value) return "—";
  const date = value instanceof Date
    ? value
    : new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (isNaN(date.getTime())) return "—";
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 30) return `Hace ${days}d`;
  return date.toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" });
}

export function CustomersTable() {
  const {
    loading,
    customers,
    total,
    totalPages,
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
  } = useCustomers();

  const perms = usePermissions(
    "customers:create",
    "customers:delete",
    "customers:pay_debt",
    "customers:view_balance",
  );
  const canCreate = perms["customers:create"];
  const canDelete = perms["customers:delete"];
  const canPayDebt = perms["customers:pay_debt"];
  const canViewBalance = perms["customers:view_balance"];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [debtDialogOpen, setDebtDialogOpen] = useState(false);
  const [debtCustomer, setDebtCustomer] = useState<Customer | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [profileCustomer, setProfileCustomer] = useState<Customer | null>(null);
  const { activeShift, addDebtPaymentToShift } = useShift();

  const handleAddNew = () => { setEditingCustomer(null); setDialogOpen(true); };

  const [isExporting, setIsExporting] = useState(false);
  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const result = await window.ipcRenderer.invoke("export-customers-csv") as {
        success: boolean; filePath?: string; canceled?: boolean; message?: string;
      };
      if (result.success) {
        toast.success("Clientes exportados", { description: result.filePath });
      } else if (!result.canceled) {
        toast.error("Error al exportar", { description: result.message });
      }
    } catch {
      toast.error("Error al exportar clientes");
    } finally {
      setIsExporting(false);
    }
  };
  const handleEdit = (customer: Customer) => { setEditingCustomer(customer); setDialogOpen(true); };
  const handleDeleteClick = (customer: Customer) => { setCustomerToDelete(customer); setDeleteDialogOpen(true); };
  const handlePayDebtClick = (customer: Customer) => { setDebtCustomer(customer); setDebtDialogOpen(true); };
  const handleViewProfile = (customer: Customer) => { setProfileCustomer(customer); setProfileDialogOpen(true); };

  // Devuelve el resultado: CustomerDialog mantiene el formulario abierto (y los
  // datos escritos) cuando el guardado falla, en lugar de cerrarse y perderlos.
  const handleSaveCustomer = async (data: Partial<Customer>) => {
    const success = await handleSave(data, editingCustomer);
    if (success) setDialogOpen(false);
    return success;
  };

  const handleDeleteConfirm = async () => {
    if (!customerToDelete) return;
    const success = await handleDelete(customerToDelete);
    if (success) setDeleteDialogOpen(false);
  };

  const colCount = canViewBalance ? 6 : 5;
  const isFiltered = !!searchQuery || filter !== "all";
  const clearFilters = () => { setSearchQuery(""); setFilter("all"); };

  return (
    <div className="space-y-6">
      <CustomersStats />

      {/* Standard list panel: header → single toolbar row → content → pagination */}
      <div className="bg-card border border-border rounded-lg p-5 space-y-3">
        <WidgetHeader
          icon={Users}
          title="Lista de Clientes"
          subtitle={`${total} cliente${total !== 1 ? "s" : ""} registrado${total !== 1 ? "s" : ""}`}
          action={
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                title="Exportar clientes a CSV"
                aria-label="Exportar clientes a CSV"
                onClick={handleExportCsv}
                disabled={isExporting}
                aria-busy={isExporting || undefined}
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
                ) : (
                  <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                )}
              </Button>
              {canCreate && (
                <Button onClick={handleAddNew} size="sm" className="h-9">
                  <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  Nuevo Cliente
                </Button>
              )}
            </div>
          }
        />

        {/* Single toolbar row: search · filter chips · sort */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <div className="relative w-88 shrink-0">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <Input
              type="search"
              placeholder="Buscar por nombre, teléfono o email"
              aria-label="Buscar clientes por nombre, teléfono o email"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 pr-8 bg-background [&::-webkit-search-cancel-button]:hidden"
              autoComplete="off"
              spellCheck={false}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="Limpiar búsqueda"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5" role="group" aria-label="Filtrar clientes">
            {FILTERS.map((f) => {
              const active = filter === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "px-3 h-9 rounded-full border text-xs font-medium transition-colors whitespace-nowrap",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted"
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          <div className="flex-1 min-w-2" />

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as CustomerSortBy)}>
            <SelectTrigger className="h-9 w-[180px] bg-background" aria-label="Ordenar por">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
            title={sortOrder === "ASC" ? "Orden ascendente (clic para descendente)" : "Orden descendente (clic para ascendente)"}
            aria-label={sortOrder === "ASC" ? "Orden ascendente. Cambiar a descendente" : "Orden descendente. Cambiar a ascendente"}
            onClick={() => setSortOrder(sortOrder === "ASC" ? "DESC" : "ASC")}
          >
            {sortOrder === "ASC" ? (
              <ArrowUpNarrowWide className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <ArrowDownWideNarrow className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            )}
          </Button>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border">
                <TableHead className="text-xs font-medium text-muted-foreground">Cliente</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right">Compras</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right">Total Gastado</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right">Última Compra</TableHead>
                {canViewBalance && (
                  <TableHead className="text-xs font-medium text-muted-foreground text-right">Deuda</TableHead>
                )}
                <TableHead className="text-xs font-medium text-muted-foreground text-right">
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeletonRows rows={6} cols={colCount} />
              ) : customers.length === 0 ? (
                isFiltered ? (
                  // Estado vacío por filtros: explica el motivo y ofrece la salida
                  // (HIG Feedback: "help them understand why" + recovery path).
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={colCount} className="h-40 text-center">
                      <div className="flex flex-col items-center justify-center text-muted-foreground gap-1">
                        <SearchX className="h-10 w-10 mb-1 opacity-30" strokeWidth={1.5} aria-hidden="true" />
                        <p className="font-medium text-foreground">No se encontraron clientes</p>
                        <p className="text-xs">
                          {searchQuery
                            ? <>Sin resultados para <span className="font-medium text-foreground">“{searchQuery}”</span>{filter !== "all" ? " con el filtro aplicado" : ""}.</>
                            : "Ningún cliente coincide con el filtro aplicado."}
                        </p>
                        <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>
                          <X className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                          Limpiar búsqueda y filtros
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <EmptyStateRow
                    icon={Users}
                    title="No hay clientes registrados"
                    description={canCreate ? "Agrega tu primer cliente con el botón “Nuevo Cliente”" : "Aún no se ha registrado ningún cliente"}
                    colSpan={colCount}
                  />
                )
              ) : (
                customers.map((customer) => {
                  const balance = Number(customer.balance || 0);
                  const creditLimit = customer.credit_limit != null ? Number(customer.credit_limit) : null;
                  const isOverLimit = creditLimit !== null && balance >= creditLimit;
                  const contact = customer.phone ? formatPhone(customer.phone) : customer.email || null;
                  const debtClass = isOverLimit
                    ? "text-red-700 dark:text-red-400"
                    : "text-amber-700 dark:text-amber-400";

                  return (
                    <TableRow key={customer.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="max-w-[280px]">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground text-xs font-semibold shrink-0 select-none"
                            aria-hidden="true"
                          >
                            {customer.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-medium text-foreground truncate" title={customer.name}>{customer.name}</span>
                              {creditLimit !== null && canViewBalance && (
                                <span
                                  className={cn(
                                    "shrink-0 px-2 py-0.5 rounded-full text-[11px] leading-4 font-medium whitespace-nowrap",
                                    isOverLimit
                                      ? "bg-red-500/10 text-red-700 dark:text-red-400"
                                      : "bg-muted text-muted-foreground"
                                  )}
                                  title={`Límite de crédito: ${formatCurrency(creditLimit)}`}
                                >
                                  {isOverLimit ? "Límite excedido" : "Crédito"}
                                </span>
                              )}
                            </div>
                            <p
                              className={cn("text-xs truncate tabular-nums", contact ? "text-muted-foreground" : "text-muted-foreground/70 italic")}
                              title={contact ?? undefined}
                            >
                              {contact ?? "Sin contacto"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {customer.purchases_count > 0
                          ? customer.purchases_count
                          : <span className="text-muted-foreground/60" aria-label="Sin compras">—</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums whitespace-nowrap">
                        {customer.total_spent > 0
                          ? formatCurrency(customer.total_spent)
                          : <span className="text-muted-foreground/60" aria-label="Sin compras">—</span>}
                      </TableCell>
                      <TableCell
                        className="text-right text-sm text-muted-foreground whitespace-nowrap tabular-nums"
                        title={customer.last_purchase_at ? formatDateTime(customer.last_purchase_at) : undefined}
                      >
                        {formatRecency(customer.last_purchase_at)}
                      </TableCell>
                      {canViewBalance && (
                        <TableCell className="text-right whitespace-nowrap">
                          {balance > 0 ? (
                            canPayDebt ? (
                              <button
                                type="button"
                                onClick={() => handlePayDebtClick(customer)}
                                className={cn(
                                  "inline-flex items-center gap-1.5 h-7 -mr-1.5 px-1.5 rounded-full text-sm font-mono tabular-nums font-medium hover:underline hover:bg-muted/60 transition-colors cursor-pointer",
                                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                  debtClass
                                )}
                                title="Abonar a deuda"
                                aria-label={`Deuda ${formatCurrency(balance)}${isOverLimit ? ", límite excedido" : ""}. Abonar a deuda de ${customer.name}`}
                              >
                                <HandCoins className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                                {formatCurrency(balance)}
                              </button>
                            ) : (
                              <span
                                className={cn("text-sm font-mono tabular-nums font-medium", debtClass)}
                                aria-label={`Deuda ${formatCurrency(balance)}${isOverLimit ? ", límite excedido" : ""}`}
                              >
                                {formatCurrency(balance)}
                              </span>
                            )
                          ) : (
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] leading-4 font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                              Sin deuda
                            </span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => handleViewProfile(customer)}
                            title="Ver perfil"
                            aria-label={`Ver perfil de ${customer.name}`}
                          >
                            <Eye className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                          </Button>
                          {canPayDebt && canViewBalance && balance > 0 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => handlePayDebtClick(customer)}
                              title="Abonar a deuda"
                              aria-label={`Abonar a deuda de ${customer.name}`}
                            >
                              <HandCoins className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                            </Button>
                          )}
                          {canCreate && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => handleEdit(customer)}
                              title="Editar"
                              aria-label={`Editar a ${customer.name}`}
                            >
                              <Pencil className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteClick(customer)}
                              title="Eliminar"
                              aria-label={`Eliminar a ${customer.name}`}
                            >
                              <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <TablePagination
          page={currentPage}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          totalItems={total}
          onPageChange={setCurrentPage}
        />
      </div>

      <CustomerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        customer={editingCustomer}
        onSave={handleSaveCustomer}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Eliminar Cliente"
        description={<>¿Estás seguro que deseas eliminar a <strong>{customerToDelete?.name}</strong>? Esta acción no se puede deshacer.</>}
        onConfirm={handleDeleteConfirm}
      />

      <PayDebtDialog
        open={debtDialogOpen}
        onOpenChange={setDebtDialogOpen}
        customer={debtCustomer}
        shiftId={activeShift?.id}
        onSuccess={(payment) => {
          fetchCustomers();
          window.dispatchEvent(new Event("customers-updated"));
          if (payment) {
            addDebtPaymentToShift(payment);
          }
        }}
      />

      <CustomerProfileDialog
        open={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
        customer={profileCustomer}
      />
    </div>
  );
}
