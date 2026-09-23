import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@components/ui/table";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import { Plus, Search, Pencil, Trash2, Truck, HandCoins, Eye, X, ArrowUpNarrowWide, ArrowDownWideNarrow, Download, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { WidgetHeader } from "@renderer/shared/components/widget-header";
import { TablePagination } from "@renderer/shared/components/table-pagination";
import { TableSkeletonRows } from "@renderer/shared/components/table-skeleton";
import { EmptyStateRow } from "@renderer/shared/components/empty-state";
import { DeleteConfirmDialog } from "@renderer/shared/components/delete-confirm-dialog";
import { usePermissions } from "@renderer/features/auth/hooks/use-permission";
import { useShift } from "@renderer/features/pos/hooks/use-shift";
import { Supplier } from "@shared/types/models";
import { formatCurrency } from "@lib/currency";
import { formatPhone } from "@lib/formatters";
import { cn } from "@lib/utils";
import { useSuppliers } from "../hooks/use-suppliers";
import { SupplierDialog } from "./supplier-dialog";
import { PaySupplierDialog } from "./pay-supplier-dialog";
import { SupplierProfileDialog } from "./supplier-profile-dialog";
import { PurchaseDialog } from "./purchase-dialog";
import type { SupplierFilter, SupplierSortBy } from "../types";

const FILTERS: { value: SupplierFilter; label: string }[] = [
  { value: "all", label: "Activos" },
  { value: "debtors", label: "Con cuenta por pagar" },
  { value: "inactive", label: "Inactivos" },
];
const SORT_OPTIONS: { value: SupplierSortBy; label: string }[] = [
  { value: "name", label: "Nombre" },
  { value: "balance", label: "Cuenta por pagar" },
  { value: "total_purchased", label: "Más comprado" },
  { value: "purchases_count", label: "Más compras" },
  { value: "last_purchase_at", label: "Última compra" },
  { value: "created_at", label: "Más recientes" },
];

function formatRecency(value: string | Date | null): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value.includes("T") ? value : value.replace(" ", "T"));
  if (isNaN(date.getTime())) return "—";
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 30) return `Hace ${days}d`;
  return date.toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" });
}

export function SuppliersTable() {
  const {
    loading, suppliers, total, totalPages, searchQuery, setSearchQuery, filter, setFilter,
    sortBy, setSortBy, sortOrder, setSortOrder, currentPage, setCurrentPage, PAGE_SIZE,
    handleSave, handleDelete, refresh,
  } = useSuppliers();
  const perms = usePermissions("suppliers:manage", "suppliers:pay", "purchases:create");
  const canManage = perms["suppliers:manage"];
  const canPay = perms["suppliers:pay"];
  const canPurchase = perms["purchases:create"];
  const { activeShift, fetchActiveShift } = useShift();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Supplier | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [paySupplier, setPaySupplier] = useState<Supplier | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileSupplier, setProfileSupplier] = useState<Supplier | null>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseSupplier, setPurchaseSupplier] = useState<Supplier | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const result = (await window.ipcRenderer.invoke("suppliers:export-csv")) as { success: boolean; filePath?: string; canceled?: boolean; message?: string };
      if (result.success) toast.success("Suplidores exportados", { description: result.filePath });
      else if (!result.canceled) toast.error("Error al exportar", { description: result.message });
    } catch {
      toast.error("Error al exportar suplidores");
    } finally {
      setIsExporting(false);
    }
  };

  const openPay = (s: Supplier) => { setPaySupplier(s); setPayOpen(true); };
  const colCount = 7;

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-lg p-5 space-y-3">
        <WidgetHeader
          icon={Truck}
          title="Lista de Suplidores"
          subtitle={`${total} suplidor${total !== 1 ? "es" : ""}`}
          action={
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="icon" className="h-9 w-9" title="Exportar suplidores a CSV" aria-label="Exportar suplidores a CSV" onClick={handleExportCsv} disabled={isExporting}>
                <Download className="h-4 w-4" strokeWidth={1.75} />
              </Button>
              {canPurchase && (
                <Button variant="outline" onClick={() => { setPurchaseSupplier(null); setPurchaseOpen(true); }} size="sm" className="h-9">
                  <PackagePlus className="h-4 w-4" strokeWidth={1.75} />
                  Nueva Compra
                </Button>
              )}
              {canManage && (
                <Button onClick={() => { setEditing(null); setDialogOpen(true); }} size="sm" className="h-9">
                  <Plus className="h-4 w-4" strokeWidth={1.75} />
                  Nuevo Suplidor
                </Button>
              )}
            </div>
          }
        />

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <div className="relative w-88 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
            <Input type="search" aria-label="Buscar suplidor" placeholder="Buscar suplidor, contacto, RNC..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-9 pl-9 pr-8 bg-background" />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-muted transition-colors" title="Limpiar búsqueda" aria-label="Limpiar búsqueda">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {FILTERS.map((f) => (
              <button key={f.value} type="button" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)} className={cn("px-3 h-9 rounded-full border text-xs font-medium transition-colors whitespace-nowrap", filter === f.value ? "bg-foreground text-background border-foreground" : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted")}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex-1 min-w-2" />
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SupplierSortBy)}>
            <SelectTrigger className="h-9 w-[190px] bg-background" aria-label="Ordenar por"><SelectValue placeholder="Ordenar por" /></SelectTrigger>
            <SelectContent>{SORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground" title={sortOrder === "ASC" ? "Orden ascendente" : "Orden descendente"} aria-label={sortOrder === "ASC" ? "Orden ascendente, cambiar a descendente" : "Orden descendente, cambiar a ascendente"} onClick={() => setSortOrder(sortOrder === "ASC" ? "DESC" : "ASC")}>
            {sortOrder === "ASC" ? <ArrowUpNarrowWide className="h-4 w-4" strokeWidth={1.75} /> : <ArrowDownWideNarrow className="h-4 w-4" strokeWidth={1.75} />}
          </Button>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b border-border">
                <TableHead className="text-xs font-medium text-muted-foreground">Suplidor</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">Contacto</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-center">Compras</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right">Total Comprado</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right">Última Compra</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right">Por Pagar</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableSkeletonRows rows={6} cols={colCount} />
              ) : suppliers.length === 0 ? (
                <EmptyStateRow icon={Truck} title={searchQuery || filter !== "all" ? "No se encontraron suplidores" : "No hay suplidores registrados"} description={searchQuery || filter !== "all" ? "Intenta ajustar la búsqueda o los filtros" : "Agrega tu primer suplidor para registrar compras"} colSpan={colCount} />
              ) : suppliers.map((s) => {
                const balance = Number(s.balance || 0);
                return (
                  <TableRow key={s.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell className="max-w-[260px]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground text-xs font-semibold shrink-0 select-none">{s.name.charAt(0).toUpperCase()}</div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-medium truncate" title={s.name}>{s.name}</span>
                            {s.credit_days > 0 && <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground" title={`${s.credit_days} días de crédito`} aria-label={`${s.credit_days} días de crédito`}>{s.credit_days}d</span>}
                            {!s.active && <span className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">Inactivo</span>}
                          </div>
                          <p className="text-xs text-muted-foreground truncate" title={s.rnc ? `RNC ${s.rnc}` : s.email || undefined}>{s.rnc ? `RNC ${s.rnc}` : s.email || "Sin RNC"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <p className="truncate max-w-[180px]" title={s.contact_name || undefined}>{s.contact_name || <span className="text-muted-foreground/50">—</span>}</p>
                      {s.phone && <p className="text-xs text-muted-foreground tabular-nums">{formatPhone(s.phone)}</p>}
                    </TableCell>
                    <TableCell className="text-center text-sm tabular-nums">{s.purchases_count > 0 ? s.purchases_count : <span className="text-muted-foreground/50">—</span>}</TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums whitespace-nowrap">{s.total_purchased > 0 ? formatCurrency(s.total_purchased) : <span className="text-muted-foreground/50">—</span>}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground whitespace-nowrap">{formatRecency(s.last_purchase_at)}</TableCell>
                    <TableCell className="text-right">
                      {balance > 0 ? (
                        canPay ? (
                          <button type="button" onClick={() => openPay(s)} className="inline-flex items-center gap-1 text-sm font-mono tabular-nums font-medium hover:underline cursor-pointer text-amber-600 dark:text-amber-400 rounded-sm" title="Pagar a este suplidor" aria-label={`Pagar ${formatCurrency(balance)} a ${s.name}`}>
                            <HandCoins className="h-3.5 w-3.5" strokeWidth={1.75} />{formatCurrency(balance)}
                          </button>
                        ) : (
                          <span className="text-sm font-mono tabular-nums font-medium text-amber-600 dark:text-amber-400">{formatCurrency(balance)}</span>
                        )
                      ) : (
                        <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Al día</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => { setProfileSupplier(s); setProfileOpen(true); }} title="Ver ficha" aria-label={`Ver ficha de ${s.name}`}><Eye className="h-4 w-4" strokeWidth={1.75} /></Button>
                        {canPurchase && s.active && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => { setPurchaseSupplier(s); setPurchaseOpen(true); }} title="Registrar compra" aria-label={`Registrar compra a ${s.name}`}><PackagePlus className="h-4 w-4" strokeWidth={1.75} /></Button>
                        )}
                        {canPay && balance > 0 && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => openPay(s)} title="Pagar" aria-label={`Pagar a ${s.name}`}><HandCoins className="h-4 w-4" strokeWidth={1.75} /></Button>
                        )}
                        {canManage && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => { setEditing(s); setDialogOpen(true); }} title="Editar" aria-label={`Editar ${s.name}`}><Pencil className="h-4 w-4" strokeWidth={1.75} /></Button>
                        )}
                        {canManage && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => { setToDelete(s); setDeleteOpen(true); }} title="Eliminar" aria-label={`Eliminar ${s.name}`}><Trash2 className="h-4 w-4" strokeWidth={1.75} /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <TablePagination page={currentPage} totalPages={totalPages} pageSize={PAGE_SIZE} totalItems={total} onPageChange={setCurrentPage} />
      </div>

      <SupplierDialog open={dialogOpen} onOpenChange={setDialogOpen} supplier={editing} onSave={(data) => handleSave(data, editing)} />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminar Suplidor"
        description={<>¿Eliminar a <strong>{toDelete?.name}</strong>? Si tiene compras registradas se desactivará en lugar de borrarse, para conservar el historial.</>}
        onConfirm={async () => { if (toDelete && (await handleDelete(toDelete))) setDeleteOpen(false); }}
      />

      <PaySupplierDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        supplier={paySupplier}
        shiftId={activeShift?.id}
        onSuccess={(payment) => {
          refresh();
          window.dispatchEvent(new Event("suppliers-updated"));
          if (payment?.payment_method === "cash") void fetchActiveShift();
        }}
      />

      <SupplierProfileDialog open={profileOpen} onOpenChange={setProfileOpen} supplier={profileSupplier} onPay={(s) => openPay(s)} />

      <PurchaseDialog open={purchaseOpen} onOpenChange={setPurchaseOpen} supplier={purchaseSupplier} onCreated={() => refresh()} />
    </div>
  );
}
