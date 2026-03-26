import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@components/ui/table";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@components/ui/card";
import { Plus, Search, Pencil, Trash2, Users, ChevronLeft, ChevronRight, Phone, Mail, MapPin, HandCoins, Eye } from "lucide-react";
import { CustomerDialog } from "./customer-dialog";
import { CustomersStats } from "./customers-stats";
import { PayDebtDialog } from "./pay-debt-dialog";
import { CustomerProfileDialog } from "./customer-profile-dialog";
import { DeleteConfirmDialog } from "@renderer/shared/components/delete-confirm-dialog";
import { TableSkeletonRows } from "@renderer/shared/components/table-skeleton";
import { EmptyStateRow } from "@renderer/shared/components/empty-state";
import { useCustomers } from "../hooks/use-customers";
import { useShift } from "@renderer/features/pos/hooks/use-shift";
import { Customer } from "@shared/types/models";
import { formatCurrency } from "@lib/currency";
import { formatPhone } from "@lib/formatters";

export function CustomersTable() {
  const {
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
  } = useCustomers();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [debtDialogOpen, setDebtDialogOpen] = useState(false);
  const [debtCustomer, setDebtCustomer] = useState<Customer | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [profileCustomer, setProfileCustomer] = useState<Customer | null>(null);
  const { activeShift } = useShift();

  const handleAddNew = () => { setEditingCustomer(null); setDialogOpen(true); };
  const handleEdit = (customer: Customer) => { setEditingCustomer(customer); setDialogOpen(true); };
  const handleDeleteClick = (customer: Customer) => { setCustomerToDelete(customer); setDeleteDialogOpen(true); };
  const handlePayDebtClick = (customer: Customer) => { setDebtCustomer(customer); setDebtDialogOpen(true); };
  const handleViewProfile = (customer: Customer) => { setProfileCustomer(customer); setProfileDialogOpen(true); };

  const handleSaveCustomer = async (data: Partial<Customer>) => {
    const success = await handleSave(data, editingCustomer);
    if (success) setDialogOpen(false);
  };

  const handleDeleteConfirm = async () => {
    if (!customerToDelete) return;
    const success = await handleDelete(customerToDelete);
    if (success) setDeleteDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <CustomersStats />

      <Card className="border-border/50">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Lista de Clientes
              </CardTitle>
              <CardDescription>
                {filteredCustomers.length} cliente{filteredCustomers.length !== 1 ? "s" : ""} encontrado
                {filteredCustomers.length !== 1 ? "s" : ""}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar clientes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Button onClick={handleAddNew} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Nuevo Cliente
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-semibold">Nombre</TableHead>
                  <TableHead className="font-semibold">Teléfono</TableHead>
                  <TableHead className="font-semibold">Email</TableHead>
                  <TableHead className="font-semibold">Dirección</TableHead>
                  <TableHead className="font-semibold text-right">Deuda</TableHead>
                  <TableHead className="text-right font-semibold">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableSkeletonRows rows={5} cols={6} />
                ) : paginatedCustomers.length === 0 ? (
                  <EmptyStateRow
                    icon={Users}
                    title={searchQuery ? "No se encontraron clientes" : "No hay clientes registrados"}
                    description={searchQuery ? "Intenta con otro término de búsqueda" : "Agrega tu primer cliente para comenzar"}
                    colSpan={6}
                  />
                ) : (
                  paginatedCustomers.map((customer) => {
                    const balance = Number(customer.balance || 0);
                    const creditLimit = customer.credit_limit != null ? Number(customer.credit_limit) : null;
                    const isOverLimit = creditLimit !== null && balance >= creditLimit;
                    
                    return (
                      <TableRow key={customer.id} className="hover:bg-muted/20 transition-colors">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{customer.name}</span>
                            {isOverLimit && (
                              <span className="text-[10px] font-semibold text-destructive mt-0.5">Límite excedido</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {customer.phone ? (
                            <span className="flex items-center gap-1.5 text-sm">
                              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                              {formatPhone(customer.phone)}
                            </span>
                          ) : <span className="text-muted-foreground/50 text-sm">—</span>}
                        </TableCell>
                        <TableCell>
                          {customer.email ? (
                            <span className="flex items-center gap-1.5 text-sm">
                              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                              {customer.email}
                            </span>
                          ) : <span className="text-muted-foreground/50 text-sm">—</span>}
                        </TableCell>
                        <TableCell>
                          {customer.address ? (
                            <span className="flex items-center gap-1.5 text-sm max-w-[200px] truncate">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              {customer.address}
                            </span>
                          ) : <span className="text-muted-foreground/50 text-sm">—</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          {balance > 0 ? (
                            <button
                              onClick={() => handlePayDebtClick(customer)}
                              className={`inline-flex items-center gap-1 text-sm font-semibold hover:underline cursor-pointer ${isOverLimit ? 'text-destructive' : 'text-amber-600 dark:text-amber-400'}`}
                              title="Abonar a deuda"
                            >
                              <HandCoins className="h-3.5 w-3.5" />
                              {formatCurrency(balance)}
                            </button>
                          ) : (
                            <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                              Sin deuda
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 dark:text-blue-400" onClick={() => handleViewProfile(customer)} title="Ver Perfil">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {balance > 0 && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:text-amber-700" onClick={() => handlePayDebtClick(customer)} title="Abonar">
                                <HandCoins className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(customer)} title="Editar">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteClick(customer)} title="Eliminar">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2 py-4">
              <p className="text-sm text-muted-foreground">
                Mostrando {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filteredCustomers.length)} de {filteredCustomers.length}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage <= 1} onClick={() => setCurrentPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium">{currentPage} / {totalPages}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={currentPage >= totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
        onSuccess={() => fetchCustomers()}
      />

      <CustomerProfileDialog
        open={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
        customer={profileCustomer}
      />
    </div>
  );
}
