import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import { Skeleton } from "@components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@components/ui/table";
import {
  Plus, Search, Tag, Package, X, LayoutGrid, List,
  ArrowUpNarrowWide, ArrowDownWideNarrow, Pencil, Archive, Boxes, Download, History, Barcode,
  AlertTriangle, XCircle, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { InventoryStats } from "./inventory-stats";
import { ProductDialog } from "./product-dialog";
import { InventoryProductCard } from "./inventory-product-card";
import { CategoryManagerDialog } from "./category-manager-dialog";
import { AdjustStockDialog } from "./adjust-stock-dialog";
import { StockMovementsDialog } from "./stock-movements-dialog";
import { PrintLabelsDialog } from "./print-labels-dialog";
import { ArchivedProductsDialog } from "./archived-products-dialog";
import { DeleteConfirmDialog } from "@renderer/shared/components/delete-confirm-dialog";
import { WidgetHeader } from "@renderer/shared/components/widget-header";
import { TablePagination } from "@renderer/shared/components/table-pagination";
import { useMinimumLoading } from "@renderer/shared/hooks/use-minimum-loading";
import { formatQty, unitDef } from "@shared/units";
import { formatCurrency } from "@lib/currency";
import { productImageSrc } from "@lib/image";
import { cn } from "@lib/utils";
import { useProducts, StockFilter } from "../hooks/use-products";
import { Product } from "@shared/types/models";
import { productCodeSummary } from "./product-codes";
import { useBarcodeScanner } from "@renderer/features/pos/hooks/use-barcode-scanner";

const STOCK_FILTERS: { value: StockFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "low", label: "Bajo stock" },
  { value: "out", label: "Agotados" },
];

const SORT_OPTIONS = [
  { value: "name", label: "Nombre" },
  { value: "sale_price", label: "Precio" },
  { value: "stock", label: "Stock" },
  { value: "created_at", label: "Más recientes" },
];

export function InventoryTable() {
  const {
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
    isLoading,
    isSaving,
    error,
    pagination,
    categories,
    fetchProducts,
    handleSave,
    handleAdjustStock,
    handleDelete,
    handlePageChange,
  } = useProducts();

  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  /** Padre al crear una nueva presentación desde el dialog */
  const [variantParent, setVariantParent] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleExportCsv = useCallback(async () => {
    setIsExporting(true);
    try {
      const result = await window.ipcRenderer.invoke("export-products-csv") as {
        success: boolean; filePath?: string; canceled?: boolean; message?: string;
      };
      if (result.success) {
        toast.success("Inventario exportado", { description: result.filePath });
      } else if (!result.canceled) {
        toast.error("Error al exportar", { description: result.message });
      }
    } catch {
      toast.error("Error al exportar el inventario");
    } finally {
      setIsExporting(false);
    }
  }, []);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [movementsProduct, setMovementsProduct] = useState<Product | null>(null);
  const [movementsOpen, setMovementsOpen] = useState(false);
  const [labelsProduct, setLabelsProduct] = useState<Product | null>(null);
  const [labelsOpen, setLabelsOpen] = useState(false);

  const handleBarcodeScan = useCallback((barcode: string) => {
    // Con un dialog abierto el escaneo es para ese dialog (p. ej. agregar un
    // código al producto), no para buscar en la lista de fondo.
    if (dialogOpen || archivedOpen) return;
    setSearchQuery(barcode);
  }, [setSearchQuery, dialogOpen, archivedOpen]);

  useBarcodeScanner({ onScan: handleBarcodeScan });

  const handleEdit = useCallback((product: Product) => {
    setVariantParent(null);
    setEditingProduct(product);
    setDialogOpen(true);
  }, []);

  /** Desde el dialog del padre: pasa a editar una de sus presentaciones (remonta el dialog). */
  const handleEditVariant = useCallback((variant: Product) => {
    setVariantParent(null);
    setEditingProduct(variant);
  }, []);

  /** Desde el dialog del padre: reabre en modo "nueva presentación". */
  const handleAddVariant = useCallback((parent: Product) => {
    setEditingProduct(null);
    setVariantParent(parent);
  }, []);

  const handleDialogOpenChange = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (!open) setVariantParent(null);
  }, []);

  const handleDeleteClick = useCallback((id: string) => {
    setProductToDelete(id);
    setIsAlertOpen(true);
  }, []);

  const handleAdjustClick = useCallback((product: Product) => {
    setAdjustProduct(product);
    setAdjustOpen(true);
  }, []);

  const handleViewMovements = useCallback((product: Product) => {
    setMovementsProduct(product);
    setMovementsOpen(true);
  }, []);

  const handlePrintLabels = useCallback((product: Product) => {
    setLabelsProduct(product);
    setLabelsOpen(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (productToDelete) {
      const success = await handleDelete(productToDelete);
      if (success) {
        setIsAlertOpen(false);
        setProductToDelete(null);
      }
    }
  };

  const handleSaveProduct = async (productData: Product) => {
    const success = await handleSave(productData, editingProduct);
    if (success) {
      // Al guardar una presentación, refresca la lista de presentaciones del padre
      if (productData.parent_product_id) {
        void queryClient.invalidateQueries({
          queryKey: ["product-variants", productData.parent_product_id],
        });
      }
      setDialogOpen(false);
      setVariantParent(null);
    }
  };

  const showCostColumn = products.some((p) => p.cost_price !== undefined && p.cost_price !== null);
  const showSkeleton = useMinimumLoading(isLoading && products.length === 0, 500);
  const hasActiveFilters = !!searchQuery || selectedCategory !== "all" || stockFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setStockFilter("all");
  };

  return (
    <>
      <InventoryStats />

      {/* Standard list panel: header → single toolbar row → content → pagination */}
      <div className="mt-6 bg-card border border-border rounded-lg p-5 space-y-3">
        <WidgetHeader
          icon={Package}
          title="Lista de Productos"
          subtitle={`${pagination.totalItems.toLocaleString("es-DO")} producto${pagination.totalItems !== 1 ? "s" : ""} registrado${pagination.totalItems !== 1 ? "s" : ""}`}
          action={
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                title="Exportar inventario a CSV"
                aria-label={isExporting ? "Exportando inventario…" : "Exportar inventario a CSV"}
                aria-busy={isExporting}
                onClick={handleExportCsv}
                disabled={isLoading || isExporting}
              >
                <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => setArchivedOpen(true)}
                disabled={isLoading}
              >
                <Archive className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Archivados
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => setCategoryDialogOpen(true)}
                disabled={isLoading}
              >
                <Tag className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Categorías
              </Button>
              <Button
                size="sm"
                className="h-9"
                onClick={() => { setEditingProduct(null); setVariantParent(null); setDialogOpen(true); }}
                disabled={isLoading}
              >
                <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Nuevo Producto
              </Button>
            </div>
          }
        />

        {/* Single toolbar row: search · filter chips · category · sort · view */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <div className="relative w-88 shrink-0">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
              strokeWidth={1.75}
              aria-hidden="true"
            />
            <Input
              type="search"
              placeholder="Buscar producto, SKU o código..."
              aria-label="Buscar producto, SKU o código"
              className="h-9 pl-9 pr-9 bg-background [&::-webkit-search-cancel-button]:hidden"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isLoading}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-[1px] focus-visible:ring-ring"
                title="Limpiar búsqueda"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5" role="group" aria-label="Filtrar por nivel de stock">
            {STOCK_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStockFilter(f.value)}
                aria-pressed={stockFilter === f.value}
                disabled={isLoading}
                className={cn(
                  "px-3 h-9 rounded-full border text-xs font-medium transition-colors whitespace-nowrap",
                  "focus-visible:outline-none focus-visible:ring-[1px] focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none",
                  stockFilter === f.value
                    ? "bg-foreground text-background border-foreground"
                    : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex-1 min-w-2" />

          <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={isLoading}>
            <SelectTrigger className="h-9 w-[210px] bg-background" aria-label="Filtrar por categoría">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy} disabled={isLoading}>
            <SelectTrigger className="h-9 w-[170px] bg-background" aria-label="Ordenar por">
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
            title={sortOrder === "ASC" ? "Orden ascendente" : "Orden descendente"}
            aria-label={
              sortOrder === "ASC"
                ? "Orden ascendente. Cambiar a descendente"
                : "Orden descendente. Cambiar a ascendente"
            }
            onClick={() => setSortOrder(sortOrder === "ASC" ? "DESC" : "ASC")}
            disabled={isLoading}
          >
            {sortOrder === "ASC" ? (
              <ArrowUpNarrowWide className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <ArrowDownWideNarrow className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            )}
          </Button>

          <div
            className="flex items-center rounded-full border border-border p-0.5 shrink-0"
            role="group"
            aria-label="Modo de vista"
          >
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title="Vista de tarjetas"
              aria-label="Vista de tarjetas"
              aria-pressed={viewMode === "grid"}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                "focus-visible:outline-none focus-visible:ring-[1px] focus-visible:ring-ring",
                viewMode === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title="Vista de tabla"
              aria-label="Vista de tabla"
              aria-pressed={viewMode === "table"}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                "focus-visible:outline-none focus-visible:ring-[1px] focus-visible:ring-ring",
                viewMode === "table" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Content */}
        {error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center" role="alert">
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-3">
              <AlertCircle className="h-6 w-6 text-destructive" strokeWidth={1.5} aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold mb-1">No se pudieron cargar los productos</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">{error}</p>
            <Button onClick={() => fetchProducts()} variant="outline" className="h-9">Reintentar</Button>
          </div>
        ) : showSkeleton ? (
          // EXACT replica of the inventory card grid
          <div
            className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4"
            role="status"
            aria-busy="true"
            aria-label="Cargando productos"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border border-border rounded-lg overflow-hidden flex flex-col bg-card h-full">
                <div className="relative w-full aspect-square bg-muted/30 shrink-0">
                  <Skeleton className="absolute inset-0 rounded-none" />
                  <Skeleton className="absolute top-2 right-2 h-[22px] w-16 rounded-full bg-background/70" />
                  <Skeleton className="absolute bottom-2 left-2 h-[18px] w-20 rounded-md bg-background/70" />
                </div>
                <div className="p-3.5 flex-1 flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-3 w-2/5" />
                  <div className="pt-2 border-t border-border/50 mt-auto grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Skeleton className="h-2.5 w-10" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                    <div className="space-y-1">
                      <Skeleton className="h-2.5 w-8" />
                      <Skeleton className="h-5 w-20" />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2.5">
                    <Skeleton className="h-8 flex-1 rounded-full" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Package className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
            </div>
            <h3 className="text-base font-semibold mb-1">
              {hasActiveFilters ? "No se encontraron productos" : "No hay productos registrados"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {hasActiveFilters
                ? "Intenta ajustar los filtros de búsqueda"
                : "Agrega tu primer producto para comenzar"}
            </p>
            {hasActiveFilters ? (
              <Button variant="outline" className="mt-4 h-9" onClick={clearFilters}>
                <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Limpiar filtros
              </Button>
            ) : (
              <Button
                className="mt-4 h-9"
                onClick={() => { setEditingProduct(null); setVariantParent(null); setDialogOpen(true); }}
              >
                <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                Nuevo Producto
              </Button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          // Same card size as the POS grid
          <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
            {products.map((product) => (
              <InventoryProductCard
                key={product.id}
                product={product}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                onAdjustStock={handleAdjustClick}
                onViewMovements={handleViewMovements}
                onPrintLabels={handlePrintLabels}
                isLoading={isSaving}
              />
            ))}
          </div>
        ) : (
          // Dense table view — mature POS back-office style
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-medium text-muted-foreground">Producto</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Código</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Categoría</TableHead>
                  {showCostColumn && (
                    <TableHead className="text-xs font-medium text-muted-foreground text-right">Compra</TableHead>
                  )}
                  <TableHead className="text-xs font-medium text-muted-foreground text-right">Venta</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground text-center">Stock</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground text-right">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border">
                {products.map((product) => {
                  const imageSrc = productImageSrc(product.image);
                  const codes = productCodeSummary(product);
                  const minStock = product.min_stock ?? 5; // 0 = sin alerta, igual que el servidor
                  const isOut = product.stock === 0;
                  const isLow = product.stock > 0 && product.stock <= minStock;
                  const stockUnit = unitDef(product.unit);
                  // "12 uds" para unidades; "12.5 lb" para medidas fraccionables.
                  const stockLabel = `${formatQty(product.stock)} ${stockUnit.value === "unidad" ? "uds" : stockUnit.abbr}`;
                  const stockTitle = isOut
                    ? "Agotado"
                    : isLow
                      ? `Stock bajo (mínimo ${minStock})`
                      : `${formatQty(product.stock)} ${stockUnit.plural}`;
                  return (
                    <TableRow key={product.id} className="hover:bg-muted/40">
                      <TableCell className="max-w-[240px]">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {imageSrc && (
                            <img
                              src={imageSrc}
                              alt=""
                              loading="lazy"
                              className="h-9 w-9 rounded-md object-cover shrink-0 border border-border"
                            />
                          )}
                          <span className="text-sm font-medium truncate" title={product.name}>
                            {product.name}
                          </span>
                          {product.variant_name && (
                            <span
                              className="rounded-full bg-muted text-xs px-2 py-0.5 text-muted-foreground whitespace-nowrap shrink-0 max-w-[120px] truncate"
                              title={product.variant_name}
                            >
                              {product.variant_name}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground max-w-[150px]" title={codes.title}>
                        {codes.primary ? (
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate">{codes.primary}</span>
                            {codes.extraCount > 0 && (
                              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-sans tabular-nums shrink-0" aria-label={`y ${codes.extraCount} código${codes.extraCount !== 1 ? "s" : ""} más`}>
                                +{codes.extraCount}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span aria-label="Sin código">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate max-w-[130px]" title={product.category?.name}>
                        {product.category?.name || <span aria-label="Sin categoría">—</span>}
                      </TableCell>
                      {showCostColumn && (
                        <TableCell className="text-right font-mono text-sm tabular-nums whitespace-nowrap text-muted-foreground">
                          {product.cost_price !== undefined && product.cost_price !== null
                            ? formatCurrency(product.cost_price)
                            : "—"}
                        </TableCell>
                      )}
                      <TableCell className="text-right font-mono text-sm font-medium tabular-nums whitespace-nowrap">
                        {formatCurrency(product.sale_price)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          title={stockTitle}
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap tabular-nums",
                            isOut
                              ? "bg-red-500/10 text-red-600 dark:text-red-400"
                              : isLow
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-muted text-foreground"
                          )}
                        >
                          {isOut ? (
                            <>
                              <XCircle className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                              Agotado
                            </>
                          ) : isLow ? (
                            <>
                              <AlertTriangle className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                              {stockLabel}
                              <span className="sr-only"> (stock bajo)</span>
                            </>
                          ) : (
                            <>{stockLabel}</>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => handlePrintLabels(product)}
                            title="Imprimir etiquetas"
                            aria-label={`Imprimir etiquetas de ${product.name}`}
                          >
                            <Barcode className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => handleViewMovements(product)}
                            title="Movimientos de stock"
                            aria-label={`Movimientos de stock de ${product.name}`}
                          >
                            <History className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => handleAdjustClick(product)}
                            title="Ajustar stock"
                            aria-label={`Ajustar stock de ${product.name}`}
                          >
                            <Boxes className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => handleEdit(product)}
                            title="Editar"
                            aria-label={`Editar ${product.name}`}
                          >
                            <Pencil className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteClick(product.id)}
                            title="Archivar"
                            aria-label={`Archivar ${product.name}`}
                          >
                            <Archive className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <TablePagination
          page={pagination.currentPage}
          totalPages={pagination.totalPages}
          pageSize={pagination.pageSize}
          totalItems={pagination.totalItems}
          onPageChange={handlePageChange}
        />
      </div>

      <ProductDialog
        key={dialogOpen ? (editingProduct?.id || (variantParent ? `variant-of-${variantParent.id}` : 'new')) : 'closed'}
        open={dialogOpen}
        onOpenChange={handleDialogOpenChange}
        product={editingProduct}
        onSave={handleSaveProduct}
        isSaving={isSaving}
        variantParent={variantParent}
        onEditVariant={handleEditVariant}
        onAddVariant={handleAddVariant}
      />

      <AdjustStockDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        product={adjustProduct}
        onAdjust={handleAdjustStock}
        isSaving={isSaving}
      />

      <StockMovementsDialog
        open={movementsOpen}
        onOpenChange={setMovementsOpen}
        product={movementsProduct}
      />

      <PrintLabelsDialog
        open={labelsOpen}
        onOpenChange={setLabelsOpen}
        product={labelsProduct}
      />

      <DeleteConfirmDialog
        open={isAlertOpen}
        onOpenChange={setIsAlertOpen}
        title="¿Archivar producto?"
        description="Dejará de aparecer en el inventario y en el punto de venta. Su historial se conserva y puedes restaurarlo cuando quieras desde Archivados."
        confirmLabel="Archivar"
        loadingLabel="Archivando…"
        onConfirm={handleDeleteConfirm}
        isLoading={isSaving}
      />

      <ArchivedProductsDialog open={archivedOpen} onOpenChange={setArchivedOpen} />

      <CategoryManagerDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        selectedCategory={selectedCategory}
        onSelectedCategoryReset={() => setSelectedCategory("all")}
        onCategoriesChanged={() => fetchProducts()}
      />
    </>
  );
}
