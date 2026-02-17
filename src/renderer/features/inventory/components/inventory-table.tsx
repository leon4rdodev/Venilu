

import { useState, useEffect, useMemo, useCallback } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@components/ui/dropdown-menu"
import { Button } from "@components/ui/button"
import { Badge } from "@components/ui/badge"
import { Card, CardContent } from "@components/ui/card"
import { MoreHorizontal, Pencil, Trash2, Plus, Search, Tag } from "lucide-react"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@components/ui/alert-dialog';
import { Input } from "@components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select"
import { ipc } from "@lib/ipc"
import { InventoryStats } from "./inventory-stats"
import { ProductDialog } from "./product-dialog"
import { InventoryPagination } from "./inventory-pagination"
import { formatCurrency } from "@lib/currency"
import { toast } from "sonner"
import { useCategories } from "@renderer/features/settings"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@components/ui/dialog"
import { Label } from "@components/ui/label"

import { Product } from "@shared/types/models";

type PaginationData = {
  currentPage: number
  pageSize: number
  totalItems: number
  totalPages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}

export function InventoryTable() {
  const [products, setProducts] = useState<Product[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Category management state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryAlertOpen, setCategoryAlertOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ id: string; name: string } | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<{ id: string; name: string; product_count?: number } | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  // Load categories dynamically
  const { categories: categoryList, createCategory, updateCategory, deleteCategory, loadCategories } = useCategories(true);

  // Pagination state
  const [pagination, setPagination] = useState<PaginationData>({
    currentPage: 1,
    pageSize: 50,
    totalItems: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false
  });

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchProducts = useCallback(async (
    page: number = pagination.currentPage,
    pageSize: number = pagination.pageSize,
    search: string = debouncedSearch,
    category: string = selectedCategory
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await ipc.invoke('get-products', {
        page,
        pageSize,
        search,
        category,
        sortBy: 'name',
        sortOrder: 'ASC'
      }) as {
        success: boolean;
        products?: Product[];
        pagination?: PaginationData;
        message?: string;
      };

      if (result.success && result.products && result.pagination) {
        setProducts(result.products);
        setPagination(result.pagination);
      } else {
        setError(result.message || 'Error al cargar productos');
        toast.error('Error al cargar productos', {
          description: result.message
        });
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Error de conexión');
      toast.error('Error de conexión', {
        description: 'No se pudieron cargar los productos'
      });
    } finally {
      setIsLoading(false);
    }
  }, [pagination.currentPage, pagination.pageSize, debouncedSearch, selectedCategory]);

  // Initial load and when filters change
  useEffect(() => {
    fetchProducts(1); // Reset to page 1 when filters change
  }, [debouncedSearch, selectedCategory]);

  const handleEdit = useCallback((product: Product) => {
    setEditingProduct(product)
    setDialogOpen(true)
  }, []);

  const handleDeleteClick = useCallback((id: string) => {
    setProductToDelete(id);
    setIsAlertOpen(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (productToDelete !== null) {
      setIsSaving(true);
      try {
        await ipc.invoke('delete-product', productToDelete);
        setIsAlertOpen(false);
        setProductToDelete(null);
        toast.success('Producto eliminado');
        await fetchProducts(); // Reload current page
        await loadCategories(); // Reload categories to update product counts
        window.dispatchEvent(new CustomEvent('inventory-updated'));
      } catch (error) {
        toast.error('Error al eliminar producto');
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleAdd = useCallback(() => {
    setEditingProduct(null)
    setDialogOpen(true)
  }, []);

  const handleSave = async (productData: Product) => {
    setIsSaving(true);
    try {
      let result: any;
      if (editingProduct) {
        // Use the ID from productData which is what the dialog just submitted
        // Fallback to editingProduct.id if for some reason it's missing in productData
        const productId = productData.id || editingProduct.id;
        
        console.log('InventoryTable: Attempting update for ID:', `"${productId}"`);
        
        if (!productId) {
            throw new Error("No se pudo identificar el ID del producto para actualizar");
        }

        result = await ipc.invoke('update-product', { 
            productId, 
            productData 
        });
      } else {
        console.log('InventoryTable: Creating new product');
        result = await ipc.invoke('create-product', productData);
      }

      if (result && result.success) {
        toast.success(editingProduct ? 'Producto actualizado' : 'Producto creado');
        setDialogOpen(false);
        await fetchProducts(); // Reload current page
        await loadCategories(); // Reload categories to update product counts
        window.dispatchEvent(new CustomEvent('inventory-updated'));
      } else {
        throw new Error(result?.message || 'Error en la operación');
      }
    } catch (error: any) {
      console.error('InventoryTable handleSave error:', error);
      toast.error('Error al guardar producto', {
        description: error.message || 'Ha ocurrido un error inesperado'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePageChange = useCallback((page: number) => {
    fetchProducts(page, pagination.pageSize, debouncedSearch, selectedCategory);
  }, [fetchProducts, pagination.pageSize, debouncedSearch, selectedCategory]);

  const handlePageSizeChange = useCallback((pageSize: number) => {
    fetchProducts(1, pageSize, debouncedSearch, selectedCategory);
  }, [fetchProducts, debouncedSearch, selectedCategory]);

  // Build categories list for filter
  const categories = useMemo(() => {
    return [
      { id: 'all', name: 'Todas las categorías' },
      ...categoryList.map(c => ({ id: c.id.toString(), name: c.name }))
    ];
  }, [categoryList]);

  // Category management functions
  const handleAddCategory = () => {
    setEditingCategory(null);
    setCategoryName("");
    setCategoryDialogOpen(true);
  };

  const handleEditCategory = (category: { id: string; name: string }) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryDialogOpen(true);
  };

  const handleDeleteCategoryClick = (category: { id: string; name: string; product_count?: number }) => {
    setCategoryToDelete(category);
    setCategoryAlertOpen(true);
  };

  const handleSaveCategory = async () => {
    const trimmed = categoryName.trim();

    if (!trimmed) {
      toast.error('Error', {
        description: 'El nombre de la categoría no puede estar vacío'
      });
      return;
    }

    setSavingCategory(true);

    try {
      let result;
      if (editingCategory) {
        result = await updateCategory(editingCategory.id, trimmed);
        if (result.success) {
          toast.success('Categoría actualizada');
          setCategoryName(""); // Clear input
          setEditingCategory(null); // Exit edit mode
          await loadCategories(); // Reload categories
          await fetchProducts(); // Refresh products to show updated category name
          // Trigger a custom event to notify other components about category changes
          window.dispatchEvent(new CustomEvent('categories-updated'));
        } else {
          toast.error('Error', {
            description: result.message
          });
        }
      } else {
        result = await createCategory(trimmed);
        if (result.success) {
          toast.success('Categoría creada');
          setCategoryName(""); // Clear input for next category
          await loadCategories(); // Reload categories
          // Trigger a custom event to notify other components about category changes
          window.dispatchEvent(new CustomEvent('categories-updated'));
        } else {
          toast.error('Error', {
            description: result.message
          });
        }
      }
    } catch (error) {
      toast.error('Error al guardar categoría');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategoryConfirm = async () => {
    if (!categoryToDelete) return;

    setSavingCategory(true);

    try {
      const result = await deleteCategory(categoryToDelete.id);
      if (result.success) {
        toast.success('Categoría eliminada');
        setCategoryAlertOpen(false);

        // If the deleted category was currently selected in the filter, reset to 'all'
        if (selectedCategory === categoryToDelete.id.toString()) {
          setSelectedCategory('all');
        }

        setCategoryToDelete(null);
        await loadCategories(); // Reload categories
        // Trigger a custom event to notify other components about category changes
        window.dispatchEvent(new CustomEvent('categories-updated'));
      } else {
        toast.error('Error', {
          description: result.message
        });
      }
    } catch (error) {
      toast.error('Error al eliminar categoría');
    } finally {
      setSavingCategory(false);
    }
  };

  return (
    <>
      <InventoryStats />
      <Card className="mt-6 border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
        <div className="p-6 border-b flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar producto..."
                className="pl-10 w-[300px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={isLoading}
              />
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
            <Button variant="outline" size="sm" onClick={handleAddCategory} disabled={isLoading}>
              <Tag className="mr-2 h-4 w-4" />
              Gestionar Categorías
            </Button>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleAdd} disabled={isLoading}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar Producto
            </Button>
          </div>
        </div>
        <CardContent className="p-0">
          {error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-destructive mb-2">Error al cargar productos</p>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => fetchProducts()} variant="outline">
                Reintentar
              </Button>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground mb-2">No se encontraron productos</p>
              <p className="text-sm text-muted-foreground">
                {searchQuery || selectedCategory !== 'all'
                  ? 'Intenta ajustar los filtros de búsqueda'
                  : 'Comienza agregando tu primer producto'
                }
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Precio de Compra</TableHead>
                      <TableHead>Precio de Venta</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="font-mono text-xs truncate max-w-[100px]" title={product.sku}>{product.sku || '-'}</TableCell>
                        <TableCell className="font-medium truncate max-w-[200px]" title={product.name}>{product.name}</TableCell>
                        <TableCell className="truncate max-w-[150px]" title={product.category?.name}>{product.category?.name || '-'}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatCurrency(product.cost_price)}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatCurrency(product.sale_price)}</TableCell>
                        <TableCell>
                          <Badge variant={product.stock <= (product.min_stock || 5) ? "destructive" : "secondary"}>{product.stock} unidades</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(product)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                className="text-destructive" 
                                onClick={(e) => {
                                  if (product.has_sales) {
                                    e.preventDefault();
                                    return;
                                  }
                                  handleDeleteClick(product.id)
                                }}
                                disabled={!!product.has_sales}
                              >
                                {product.has_sales ? (
                                  <span className="flex items-center text-muted-foreground cursor-not-allowed w-full">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    No eliminable
                                  </span>
                                ) : (
                                  <span className="flex items-center w-full">
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Eliminar
                                  </span>
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="border-t">
                <InventoryPagination
                  currentPage={pagination.currentPage}
                  totalPages={pagination.totalPages}
                  pageSize={pagination.pageSize}
                  totalItems={pagination.totalItems}
                  onPageChange={handlePageChange}
                  onPageSizeChange={handlePageSizeChange}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editingProduct}
        onSave={handleSave}
        isSaving={isSaving}
      />

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente el producto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} disabled={isSaving}>
              {isSaving ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Category Management Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Gestionar Categorías
            </DialogTitle>
            <DialogDescription>
              Crea, edita o elimina categorías para organizar tu inventario
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Add new category section */}
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor="new-category">Nueva Categoría</Label>
                <Input
                  id="new-category"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="Nombre de la categoría..."
                  disabled={savingCategory}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !editingCategory) {
                      handleSaveCategory();
                    }
                  }}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleSaveCategory} disabled={savingCategory || !categoryName.trim()}>
                  {savingCategory ? 'Guardando...' : (editingCategory ? 'Actualizar' : 'Agregar')}
                </Button>
              </div>
            </div>

            {/* Categories list */}
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Productos</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categoryList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        No hay categorías creadas
                      </TableCell>
                    </TableRow>
                  ) : (
                    categoryList.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell className="font-medium">{category.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {category.product_count || 0} producto{category.product_count !== 1 ? 's' : ''}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditCategory(category)}
                              disabled={savingCategory}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteCategoryClick(category)}
                              disabled={savingCategory}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCategoryDialogOpen(false);
              setEditingCategory(null);
              setCategoryName("");
            }}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Category Confirmation */}
      <AlertDialog open={categoryAlertOpen} onOpenChange={setCategoryAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
            <AlertDialogDescription>
              {categoryToDelete && categoryToDelete.product_count && categoryToDelete.product_count > 0 ? (
                <>
                  No se puede eliminar la categoría <strong>{categoryToDelete.name}</strong> porque tiene{' '}
                  <strong>{categoryToDelete.product_count} producto{categoryToDelete.product_count !== 1 ? 's' : ''}</strong> asociado{categoryToDelete.product_count !== 1 ? 's' : ''}.
                  <br /><br />
                  Primero debes reasignar o eliminar los productos que usan esta categoría.
                </>
              ) : (
                <>
                  ¿Estás seguro de que deseas eliminar la categoría <strong>{categoryToDelete?.name}</strong>?
                  Esta acción no se puede deshacer.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={savingCategory}>Cancelar</AlertDialogCancel>
            {categoryToDelete && (!categoryToDelete.product_count || categoryToDelete.product_count === 0) && (
              <AlertDialogAction onClick={handleDeleteCategoryConfirm} disabled={savingCategory}>
                {savingCategory ? 'Eliminando...' : 'Eliminar'}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
