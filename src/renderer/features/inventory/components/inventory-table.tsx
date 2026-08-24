import { useState, useCallback } from "react";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import { Skeleton } from "@components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@components/ui/table";
import {
  Plus, Search, Tag, Package, X, LayoutGrid, List,
  ArrowUpNarrowWide, ArrowDownWideNarrow, Pencil, Trash2, Boxes,
} from "lucide-react";
import { InventoryStats } from "./inventory-stats";
import { ProductDialog } from "./product-dialog";
import { InventoryProductCard } from "./inventory-product-card";
import { CategoryManagerDialog } from "./category-manager-dialog";
import { AdjustStockDialog } from "./adjust-stock-dialog";
import { DeleteConfirmDialog } from "@renderer/shared/components/delete-confirm-dialog";
import { WidgetHeader } from "@renderer/shared/components/widget-header";
import { TablePagination } from "@renderer/shared/components/table-pagination";
import { useMinimumLoading } from "@renderer/shared/hooks/use-minimum-loading";
import { formatCurrency } from "@lib/currency";
import { productImageSrc } from "@lib/image";
import { cn } from "@lib/utils";
import { useProducts, StockFilter } from "../hooks/use-products";
import { Product } from "@shared/types/models";
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

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const handleBarcodeScan = useCallback((barcode: string) => {
    setSearchQuery(barcode);
  }, [setSearchQuery]);

  useBarcodeScanner({ onScan: handleBarcodeScan });

  const handleEdit = useCallback((product: Product) => {
    setEditingProduct(product);
    setDialogOpen(true);
  }, []);

  const handleDeleteClick = useCallback((id: string) => {
    setProductToDelete(id);
    setIsAlertOpen(true);
  }, []);

  const handleAdjustClick = useCallback((product: Product) => {
    setAdjustProduct(product);
    setAdjustOpen(true);
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
    if (success) setDialogOpen(false);
  };

  const showCostColumn = products.some((p) => p.cost_price !== undefined && p.cost_price !== null);
  const showSkeleton = useMinimumLoading(isLoading && products.length === 0, 500);

  return (
    <>
      <InventoryStats />

      {/* Standard list panel: header → single toolbar row → content → pagination */}
      <div className="mt-6 bg-card border border-border rounded-lg p-5 space-y-3">
        <WidgetHeader
          icon={Package}
          title="Lista de Productos"
          subtitle={`${pagination.totalItems} producto${pagination.totalItems !== 1 ? "s" : ""} registrado${pagination.totalItems !== 1 ? "s" : ""}`}
          action={
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => setCategoryDialogOpen(true)}
                disabled={isLoading}
              >
                <Tag className="h-4 w-4" strokeWidth={1.75} />
                Categorías
              </Button>
              <Button
                size="sm"
                className="h-9"
                onClick={() => { setEditingProduct(null); setDialogOpen(true); }}
                disabled={isLoading}
              >
                <Plus className="h-4 w-4" strokeWidth={1.75} />
                Nuevo Producto
              </Button>
            </div>
          }
        />

        {/* Single toolbar row: search · filter chips · category · sort · view */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <div className="relative w-56 shrink-0">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              strokeWidth={1.75}
            />
            <Input
              placeholder="Buscar producto, SKU o código..."
              className="h-9 pl-9 pr-8 bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isLoading}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-muted transition-colors"
                title="Limpiar búsqueda"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {STOCK_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStockFilter(f.value)}
                className={cn(
                  "px-3 h-9 rounded-full border text-xs font-medium transition-colors whitespace-nowrap",
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
            <SelectTrigger className="h-9 w-[160px] bg-background">
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
            <SelectTrigger className="h-9 w-[150px] bg-background">
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
            title={sortOrder === "ASC" ? "Ascendente" : "Descendente"}
            onClick={() => setSortOrder(sortOrder === "ASC" ? "DESC" : "ASC")}
            disabled={isLoading}
          >
            {sortOrder === "ASC" ? (
              <ArrowUpNarrowWide className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <ArrowDownWideNarrow className="h-4 w-4" strokeWidth={1.75} />
            )}
          </Button>

          <div className="flex items-center rounded-full border border-border p-0.5 shrink-0">
            <button
              onClick={() => setViewMode("grid")}
              title="Vista de tarjetas"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                viewMode === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-4 w-4" strokeWidth={1.75} />
            </button>
            <button
              onClick={() => setViewMode("table")}
              title="Vista de tabla"
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full transition-colors",
                viewMode === "table" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <List className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        {/* Content */}
        {error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-destructive mb-2">Error al cargar productos</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => fetchProducts()} variant="outline">Reintentar</Button>
          </div>
        ) : showSkeleton ? (
          // EXACT replica of the inventory card grid
          <div className="grid grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
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
              <Package className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <h3 className="text-base font-semibold mb-1">
              {searchQuery || selectedCategory !== "all" || stockFilter !== "all"
                ? "No se encontraron productos"
                : "No hay productos registrados"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {searchQuery || selectedCategory !== "all" || stockFilter !== "all"
                ? "Intenta ajustar los filtros de búsqueda"
                : "Agrega tu primer producto para comenzar"}
            </p>
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
                  <TableHead className="text-xs font-medium text-muted-foreground">SKU</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Categoría</TableHead>
                  {showCostColumn && (
                    <TableHead className="text-xs font-medium text-muted-foreground text-right">Compra</TableHead>
                  )}
                  <TableHead className="text-xs font-medium text-muted-foreground text-right">Venta</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground text-center">Stock</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border">
                {products.map((product) => {
                  const imageSrc = productImageSrc(product.image);
                  const isOut = product.stock === 0;
                  const isLow = product.stock > 0 && product.stock <= (product.min_stock || 5);
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
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[110px]" title={product.sku}>
                        {product.sku || "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground truncate max-w-[130px]" title={product.category?.name}>
                        {product.category?.name || "—"}
                      </TableCell>
                      {showCostColumn && (
                        <TableCell className="text-right font-mono text-sm tabular-nums whitespace-nowrap">
                          {product.cost_price !== undefined ? formatCurrency(product.cost_price) : "—"}
                        </TableCell>
                      )}
                      <TableCell className="text-right font-mono text-sm font-medium tabular-nums whitespace-nowrap">
                        {formatCurrency(product.sale_price)}
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={cn(
                            "inline-flex px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap",
                            isOut
                              ? "bg-red-500/10 text-red-600 dark:text-red-400"
                              : isLow
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-muted text-foreground"
                          )}
                        >
                          {product.stock} uds
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => handleAdjustClick(product)}
                            title="Ajustar stock"
                          >
                            <Boxes className="h-4 w-4" strokeWidth={1.75} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => handleEdit(product)}
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" strokeWidth={1.75} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => !product.has_sales && handleDeleteClick(product.id)}
                            disabled={!!product.has_sales}
                            title={product.has_sales ? "No eliminable (tiene ventas)" : "Eliminar"}
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.75} />
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
        key={dialogOpen ? (editingProduct?.id || 'new') : 'closed'}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editingProduct}
        onSave={handleSaveProduct}
        isSaving={isSaving}
      />

      <AdjustStockDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        product={adjustProduct}
        onAdjust={handleAdjustStock}
        isSaving={isSaving}
      />

      <DeleteConfirmDialog
        open={isAlertOpen}
        onOpenChange={setIsAlertOpen}
        description="Esta acción no se puede deshacer. Esto eliminará permanentemente el producto."
        onConfirm={handleDeleteConfirm}
        isLoading={isSaving}
      />

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
