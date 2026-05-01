import { useState, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@components/ui/table";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@components/ui/card";
import { Badge } from "@components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import { Pencil, Trash2, Plus, Search, Tag, Package, X } from "lucide-react";
import { InventoryStats } from "./inventory-stats";
import { ProductDialog } from "./product-dialog";
import { InventoryPagination } from "./inventory-pagination";
import { CategoryManagerDialog } from "./category-manager-dialog";
import { DeleteConfirmDialog } from "@renderer/shared/components/delete-confirm-dialog";
import { TableSkeletonRows } from "@renderer/shared/components/table-skeleton";
import { EmptyStateRow } from "@renderer/shared/components/empty-state";
import { formatCurrency } from "@lib/currency";
import { useProducts } from "../hooks/use-products";
import { Product } from "@shared/types/models";
import { useBarcodeScanner } from "@renderer/features/pos/hooks/use-barcode-scanner";

export function InventoryTable() {
  const {
    products,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    isLoading,
    isSaving,
    error,
    pagination,
    categories,
    fetchProducts,
    handleSave,
    handleDelete,
    handlePageChange,
    handlePageSizeChange,
  } = useProducts();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);

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

  return (
    <>
      <InventoryStats />
      <Card className="mt-6 border-border/50">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Lista de Productos
              </CardTitle>
              <CardDescription>
                {pagination.totalItems} producto{pagination.totalItems !== 1 ? "s" : ""} registrado
                {pagination.totalItems !== 1 ? "s" : ""}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar producto..."
                  className="pl-9 pr-9 w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={isLoading}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted/80 transition-colors"
                    title="Limpiar búsqueda"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={isLoading}>
                <SelectTrigger className="w-[180px]">
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
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setCategoryDialogOpen(true)} disabled={isLoading}>
                <Tag className="mr-2 h-4 w-4" />
                Categorías
              </Button>
              <Button onClick={() => { setEditingProduct(null); setDialogOpen(true); }} size="sm" className="gap-1.5" disabled={isLoading}>
                <Plus className="h-4 w-4" />
                Nuevo Producto
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-destructive mb-2">Error al cargar productos</p>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => fetchProducts()} variant="outline">Reintentar</Button>
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="font-semibold">SKU</TableHead>
                      <TableHead className="font-semibold">Nombre</TableHead>
                      <TableHead className="font-semibold">Categoría</TableHead>
                      <TableHead className="font-semibold">P. Compra</TableHead>
                      <TableHead className="font-semibold">P. Venta</TableHead>
                      <TableHead className="font-semibold">Stock</TableHead>
                      <TableHead className="text-right font-semibold">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && products.length === 0 ? (
                      <TableSkeletonRows rows={10} cols={7} />
                    ) : products.length === 0 ? (
                      <EmptyStateRow
                        icon={Package}
                        title={searchQuery || selectedCategory !== "all" ? "No se encontraron productos" : "No hay productos registrados"}
                        description={searchQuery || selectedCategory !== "all" ? "Intenta ajustar los filtros de búsqueda" : "Agrega tu primer producto para comenzar"}
                        colSpan={7}
                      />
                    ) : (
                      products.map((product) => (
                        <TableRow key={product.id} className="hover:bg-muted/20 transition-colors">
                          <TableCell className="font-mono text-xs truncate max-w-[100px]" title={product.sku}>{product.sku || "—"}</TableCell>
                          <TableCell className="font-medium truncate max-w-[200px]" title={product.name}>{product.name}</TableCell>
                          <TableCell className="truncate max-w-[150px]" title={product.category?.name}>{product.category?.name || "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatCurrency(product.cost_price)}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatCurrency(product.sale_price)}</TableCell>
                          <TableCell>
                            <Badge variant={product.stock <= (product.min_stock || 5) ? "destructive" : "secondary"}>
                              {product.stock} uds
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(product)} title="Editar">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => !product.has_sales && handleDeleteClick(product.id)}
                                disabled={!!product.has_sales}
                                title={product.has_sales ? "No eliminable (tiene ventas)" : "Eliminar"}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {pagination.totalPages > 1 && (
                <div className="pt-2">
                  <InventoryPagination
                    currentPage={pagination.currentPage}
                    totalPages={pagination.totalPages}
                    pageSize={pagination.pageSize}
                    totalItems={pagination.totalItems}
                    onPageChange={handlePageChange}
                    onPageSizeChange={handlePageSizeChange}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ProductDialog
        key={dialogOpen ? (editingProduct?.id || 'new') : 'closed'}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editingProduct}
        onSave={handleSaveProduct}
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
