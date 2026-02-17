

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { Label } from "@components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@components/ui/alert-dialog"
import { Plus, Pencil, Trash2, Tag } from "lucide-react"
import { Spinner } from "@components/ui/spinner"
import { toast } from "sonner"
import { useCategories } from "@renderer/features/settings/hooks/use-categories"
import { Badge } from "@components/ui/badge"

export function CategorySettings() {
  const { categories, isLoading, createCategory, updateCategory, deleteCategory } = useCategories(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<{ id: string; name: string } | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<{ id: string; name: string; product_count?: number } | null>(null);

  const [categoryName, setCategoryName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleAdd = () => {
    setEditingCategory(null);
    setCategoryName("");
    setDialogOpen(true);
  };

  const handleEdit = (category: { id: string; name: string }) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setDialogOpen(true);
  };

  const handleDeleteClick = (category: { id: string; name: string; product_count?: number }) => {
    setCategoryToDelete(category);
    setAlertOpen(true);
  };

  const handleSave = async () => {
    const trimmed = categoryName.trim();

    if (!trimmed) {
      toast.error('Error', {
        description: 'El nombre de la categoría no puede estar vacío'
      });
      return;
    }

    setIsSaving(true);

    try {
      let result;
      if (editingCategory) {
        result = await updateCategory(editingCategory.id, trimmed);
        if (result.success) {
          toast.success('Categoría actualizada');
          setDialogOpen(false);
        } else {
          toast.error('Error', {
            description: result.message
          });
        }
      } else {
        result = await createCategory(trimmed);
        if (result.success) {
          toast.success('Categoría creada');
          setDialogOpen(false);
        } else {
          toast.error('Error', {
            description: result.message
          });
        }
      }
    } catch (error) {
      toast.error('Error al guardar categoría');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!categoryToDelete) return;

    setIsSaving(true);

    try {
      const result = await deleteCategory(categoryToDelete.id);
      if (result.success) {
        toast.success('Categoría eliminada');
        setAlertOpen(false);
        setCategoryToDelete(null);
      } else {
        toast.error('Error', {
          description: result.message
        });
      }
    } catch (error) {
      toast.error('Error al eliminar categoría');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-12">
          <Spinner className="size-8" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Categorías de Productos
              </CardTitle>
              <CardDescription>Gestiona las categorías para organizar tu inventario</CardDescription>
            </div>
            <Button onClick={handleAdd}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Categoría
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay categorías creadas</p>
              <p className="text-sm">Comienza agregando tu primera categoría</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Productos</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
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
                          onClick={() => handleEdit(category)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(category)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}</DialogTitle>
            <DialogDescription>
              {editingCategory ? 'Modifica el nombre de la categoría' : 'Ingresa el nombre de la nueva categoría'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category-name">Nombre de la Categoría</Label>
              <Input
                id="category-name"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Ej: Bebidas"
                disabled={isSaving}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSave();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !categoryName.trim()}>
              {isSaving ? 'Guardando...' : (editingCategory ? 'Guardar' : 'Crear')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
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
            <AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel>
            {categoryToDelete && (!categoryToDelete.product_count || categoryToDelete.product_count === 0) && (
              <AlertDialogAction onClick={handleDeleteConfirm} disabled={isSaving}>
                {isSaving ? 'Eliminando...' : 'Eliminar'}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
