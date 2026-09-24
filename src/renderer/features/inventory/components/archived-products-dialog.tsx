import { useEffect, useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Skeleton } from "@components/ui/skeleton";
import { Archive, ArchiveRestore, Package, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ipc } from "@lib/ipc";
import { formatCurrency } from "@lib/currency";
import { productImageSrc } from "@lib/image";
import { DeleteConfirmDialog } from "@renderer/shared/components/delete-confirm-dialog";
import { TablePagination } from "@renderer/shared/components/table-pagination";
import { Product } from "@shared/types/models";
import { formatQty, unitDef } from "@shared/units";

type ArchivedProductsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ArchivedPage = {
  products: Product[];
  pagination: { currentPage: number; pageSize: number; totalItems: number; totalPages: number };
};

const PAGE_SIZE = 10;

const formatDate = (value: Product["archived_at"]) =>
  value ? new Date(value).toLocaleDateString("es-DO", { day: "2-digit", month: "short", year: "numeric" }) : "";

/**
 * Carpeta de archivados: productos con borrado lógico. Desde aquí se restauran
 * al inventario o se borran definitivamente (solo si nunca se vendieron).
 */
export function ArchivedProductsDialog({ open, onOpenChange }: ArchivedProductsDialogProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Product | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (open) { setSearch(""); setDebouncedSearch(""); setPage(1); }
  }, [open]);

  // Bajo la clave "products" → CacheBridge la invalida con 'inventory-updated'
  const query = useQuery({
    queryKey: ["products", "archived", { page, search: debouncedSearch }],
    enabled: open,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const result = (await ipc.invoke("get-products", {
        archived: true, page, pageSize: PAGE_SIZE, search: debouncedSearch, sortBy: "archived_at", sortOrder: "DESC",
      })) as { success: boolean; data?: ArchivedPage; message?: string };
      if (!result.success || !result.data) throw new Error(result.message || "Error al cargar archivados");
      return result.data;
    },
  });

  const products = query.data?.products ?? [];
  const pagination = query.data?.pagination;

  // Si se vació la última página (restaurar/borrar), retrocede una
  useEffect(() => {
    if (pagination && page > 1 && page > pagination.totalPages) setPage(Math.max(1, pagination.totalPages));
  }, [pagination, page]);

  const runAction = async (channel: "restore-product" | "delete-product-permanently", product: Product, okMessage: string, errorTitle: string) => {
    setBusyId(product.id);
    try {
      const result = (await ipc.invoke(channel, product.id)) as { success: boolean; message?: string };
      if (!result?.success) {
        toast.error(errorTitle, { description: result?.message });
        return false;
      }
      toast.success(okMessage, { description: product.name });
      window.dispatchEvent(new CustomEvent("inventory-updated"));
      return true;
    } catch (err) {
      toast.error(errorTitle, { description: (err as Error).message });
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!toDelete) return;
    const ok = await runAction("delete-product-permanently", toDelete, "Producto eliminado definitivamente", "No se pudo eliminar");
    if (ok) setToDelete(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="p-6 pb-4 border-b border-border space-y-1 shrink-0">
            <DialogTitle className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <Archive className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
              Productos Archivados
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              No aparecen en el inventario ni en el punto de venta. Restáuralos cuando quieras; los que nunca se vendieron se pueden eliminar definitivamente.
            </DialogDescription>
          </div>

          {/* Body */}
          <div className="p-6 space-y-3 flex-1 overflow-y-auto min-h-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" strokeWidth={1.75} aria-hidden="true" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar en archivados..."
                aria-label="Buscar en productos archivados"
                autoComplete="off"
                className="h-9 pl-9 bg-background"
              />
            </div>

            {query.isPending ? (
              <div className="space-y-2" role="status" aria-busy="true" aria-label="Cargando productos archivados">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
              </div>
            ) : query.isError ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2" role="alert">
                <p className="text-xs text-destructive">No se pudieron cargar los productos archivados.</p>
                <Button type="button" variant="outline" size="sm" className="h-7 shrink-0" onClick={() => void query.refetch()}>
                  Reintentar
                </Button>
              </div>
            ) : products.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <div className="mx-auto w-10 h-10 rounded-full bg-muted flex items-center justify-center" aria-hidden="true">
                  <Archive className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                </div>
                <p className="text-sm font-medium">{debouncedSearch ? "Sin resultados" : "No hay productos archivados"}</p>
                <p className="text-xs text-muted-foreground">
                  {debouncedSearch ? "Prueba con otro nombre o código." : "Los productos que archives desde el inventario aparecerán aquí."}
                </p>
              </div>
            ) : (
              <ul className="rounded-lg border border-border divide-y divide-border overflow-hidden list-none p-0">
                {products.map((product) => {
                  const src = productImageSrc(product.image);
                  const busy = busyId === product.id;
                  return (
                    <li key={product.id} className="flex items-center gap-3 px-3 py-2.5">
                      {src ? (
                        <img src={src} alt="" loading="lazy" className="h-10 w-10 rounded-md object-cover border border-border shrink-0" />
                      ) : (
                        <div className="h-10 w-10 rounded-md bg-muted/50 border border-border flex items-center justify-center shrink-0" aria-hidden="true">
                          <Package className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" title={product.name}>{product.name}</p>
                        <p className="text-xs text-muted-foreground tabular-nums truncate">
                          <span className="font-mono">{formatCurrency(product.sale_price)}</span>
                          {" · "}
                          {formatQty(product.stock)}
                          {unitDef(product.unit).value !== "unidad" ? ` ${unitDef(product.unit).abbr}` : " uds"}
                          {" · "}Archivado el {formatDate(product.archived_at)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 shrink-0"
                        disabled={busyId !== null}
                        aria-busy={busy || undefined}
                        onClick={() => void runAction("restore-product", product, "Producto restaurado", "No se pudo restaurar")}
                      >
                        <ArchiveRestore className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                        Restaurar
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                        disabled={busyId !== null || !!product.has_sales}
                        onClick={() => setToDelete(product)}
                        title={product.has_sales ? "No se puede eliminar: tiene ventas o compras registradas" : "Eliminar definitivamente"}
                        aria-label={
                          product.has_sales
                            ? `No se puede eliminar ${product.name}: tiene ventas o compras registradas`
                            : `Eliminar definitivamente ${product.name}`
                        }
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}

            {pagination && pagination.totalPages > 1 && (
              <TablePagination
                page={pagination.currentPage}
                totalPages={pagination.totalPages}
                pageSize={pagination.pageSize}
                totalItems={pagination.totalItems}
                onPageChange={setPage}
              />
            )}
          </div>

          {/* Footer */}
          <div className="p-6 pt-4 border-t border-border shrink-0">
            <Button variant="outline" className="w-full h-10" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => { if (!o) setToDelete(null); }}
        title="¿Eliminar definitivamente?"
        description={<>Se borrará <span className="font-medium text-foreground">{toDelete?.name}</span> con su foto, códigos e historial de stock. Esta acción no se puede deshacer.</>}
        confirmLabel="Eliminar definitivamente"
        onConfirm={handleDeleteConfirm}
        isLoading={busyId !== null && busyId === toDelete?.id}
      />
    </>
  );
}
