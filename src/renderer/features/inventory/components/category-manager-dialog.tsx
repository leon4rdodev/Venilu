import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@components/ui/table";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Badge } from "@components/ui/badge";
import { Tag, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "@renderer/shared/components/delete-confirm-dialog";
import { useCategories } from "@renderer/features/settings";

interface CategoryManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCategoriesChanged?: () => void;
  selectedCategory?: string;
  onSelectedCategoryReset?: () => void;
}

export function CategoryManagerDialog({
  open,
  onOpenChange,
  onCategoriesChanged,
  selectedCategory,
  onSelectedCategoryReset,
}: CategoryManagerDialogProps) {
  const { categories, createCategory, updateCategory, deleteCategory, loadCategories } =
    useCategories(true);
  const [categoryName, setCategoryName] = useState("");
  const [editingCategory, setEditingCategory] = useState<{ id: string; name: string } | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<{
    id: string;
    name: string;
    product_count?: number;
  } | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleEditCategory = (category: { id: string; name: string }) => {
    setEditingCategory(category);
    setCategoryName(category.name);
  };

  const handleDeleteClick = (category: { id: string; name: string; product_count?: number }) => {
    setCategoryToDelete(category);
    setAlertOpen(true);
  };

  const handleSaveCategory = async () => {
    const trimmed = categoryName.trim();
    if (!trimmed) {
      toast.error("Error", { description: "El nombre de la categoría no puede estar vacío" });
      return;
    }
    setIsSaving(true);
    try {
      const result = editingCategory
        ? await updateCategory(editingCategory.id, trimmed)
        : await createCategory(trimmed);

      if (result.success) {
        toast.success(editingCategory ? "Categoría actualizada" : "Categoría creada");
        setCategoryName("");
        setEditingCategory(null);
        await loadCategories();
        window.dispatchEvent(new CustomEvent("categories-updated"));
        onCategoriesChanged?.();
      } else {
        toast.error("Error", { description: result.message });
      }
    } catch {
      toast.error("Error al guardar categoría");
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
        toast.success("Categoría eliminada");
        setAlertOpen(false);
        if (selectedCategory === categoryToDelete.id.toString()) {
          onSelectedCategoryReset?.();
        }
        setCategoryToDelete(null);
        await loadCategories();
        window.dispatchEvent(new CustomEvent("categories-updated"));
        onCategoriesChanged?.();
      } else {
        toast.error("Error", { description: result.message });
      }
    } catch {
      toast.error("Error al eliminar categoría");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setEditingCategory(null);
    setCategoryName("");
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
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
            {/* Add/Edit form */}
            <div className="flex gap-2">
              <div className="flex-1 space-y-2">
                <Label htmlFor="new-category">
                  {editingCategory ? `Editando: ${editingCategory.name}` : "Nueva Categoría"}
                </Label>
                <Input
                  id="new-category"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="Nombre de la categoría..."
                  disabled={isSaving}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveCategory();
                  }}
                />
              </div>
              <div className="flex items-end gap-2">
                {editingCategory && (
                  <Button
                    variant="outline"
                    onClick={() => { setEditingCategory(null); setCategoryName(""); }}
                    disabled={isSaving}
                  >
                    Cancelar
                  </Button>
                )}
                <Button onClick={handleSaveCategory} disabled={isSaving || !categoryName.trim()}>
                  {isSaving ? "Guardando..." : editingCategory ? "Actualizar" : "Agregar"}
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
                  {categories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                        No hay categorías creadas
                      </TableCell>
                    </TableRow>
                  ) : (
                    categories.map((category) => (
                      <TableRow key={category.id}>
                        <TableCell className="font-medium">{category.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {category.product_count || 0} producto
                            {category.product_count !== 1 ? "s" : ""}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditCategory(category)}
                              disabled={isSaving}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteClick(category)}
                              disabled={isSaving}
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
            <Button variant="outline" onClick={handleClose}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteConfirmDialog
        open={alertOpen}
        onOpenChange={setAlertOpen}
        title="¿Eliminar categoría?"
        description={
          categoryToDelete?.product_count && categoryToDelete.product_count > 0 ? (
            <>
              No se puede eliminar la categoría <strong>{categoryToDelete.name}</strong> porque tiene{" "}
              <strong>
                {categoryToDelete.product_count} producto
                {categoryToDelete.product_count !== 1 ? "s" : ""}
              </strong>{" "}
              asociado{categoryToDelete.product_count !== 1 ? "s" : ""}.<br />
              <br />
              Primero debes reasignar o eliminar los productos que usan esta categoría.
            </>
          ) : (
            <>
              ¿Estás seguro de que deseas eliminar la categoría{" "}
              <strong>{categoryToDelete?.name}</strong>? Esta acción no se puede deshacer.
            </>
          )
        }
        onConfirm={
          categoryToDelete?.product_count && categoryToDelete.product_count > 0
            ? () => setAlertOpen(false)
            : handleDeleteConfirm
        }
        confirmLabel={
          categoryToDelete?.product_count && categoryToDelete.product_count > 0
            ? "Entendido"
            : "Eliminar"
        }
        isLoading={isSaving}
      />
    </>
  );
}
