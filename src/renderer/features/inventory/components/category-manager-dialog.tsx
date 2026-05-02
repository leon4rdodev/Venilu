import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { Badge } from "@components/ui/badge";
import { Pencil, Trash2, Check, X, Plus } from "lucide-react";
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

  const [newName, setNewName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  const [categoryToDelete, setCategoryToDelete] = useState<{
    id: string;
    name: string;
    product_count?: number;
  } | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (editingId) {
      setTimeout(() => editInputRef.current?.focus(), 50);
    }
  }, [editingId]);

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setIsCreating(true);
    try {
      const result = await createCategory(trimmed);
      if (result.success) {
        toast.success("Categoría creada");
        setNewName("");
        await loadCategories();
        window.dispatchEvent(new CustomEvent("categories-updated"));
        onCategoriesChanged?.();
      } else {
        toast.error("Error", { description: result.message });
      }
    } catch (error: unknown) {
      console.error("Error creating category:", error);
      toast.error("Error al crear categoría");
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartEdit = (category: { id: string; name: string }) => {
    setEditingId(category.id);
    setEditingName(category.name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleSaveEdit = async () => {
    const trimmed = editingName.trim();
    if (!trimmed || !editingId) return;
    try {
      const result = await updateCategory(editingId, trimmed);
      if (result.success) {
        toast.success("Categoría actualizada");
        setEditingId(null);
        setEditingName("");
        await loadCategories();
        window.dispatchEvent(new CustomEvent("categories-updated"));
        onCategoriesChanged?.();
      } else {
        toast.error("Error", { description: result.message });
      }
    } catch (error: unknown) {
      console.error("Error updating category:", error);
      toast.error("Error al actualizar categoría");
    }
  };

  const handleDeleteClick = (category: { id: string; name: string; product_count?: number }) => {
    setCategoryToDelete(category);
    setAlertOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!categoryToDelete) return;
    setIsDeleting(true);
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
    } catch (error: unknown) {
      console.error("Error deleting category:", error);
      toast.error("Error al eliminar categoría");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setEditingId(null);
    setNewName("");
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="p-6 pb-4 border-b space-y-3 shrink-0">
            <DialogHeader>
              <DialogTitle>Gestionar Categorías</DialogTitle>
              <DialogDescription>
                Crea, edita o elimina categorías para organizar tu inventario
              </DialogDescription>
            </DialogHeader>
            {/* New category input — fixed in header */}
            <div className="flex gap-2">
                <Input
                  id="new-category"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nombre de la nueva categoría..."
                  disabled={isCreating}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") setNewName("");
                  }}
                />
                <Button
                  onClick={handleCreate}
                  disabled={isCreating || !newName.trim()}
                  className="shrink-0 gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  {isCreating ? "Creando..." : "Agregar"}
                </Button>
            </div>
          </div>

          {/* Body — scrollable */}
          <div className="flex-1 overflow-y-scroll min-h-0 p-6">
            {/* Categories table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="w-32">Productos</TableHead>
                    <TableHead className="w-24 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-10">
                        No hay categorías creadas aún
                      </TableCell>
                    </TableRow>
                  ) : (
                    categories.map((category) => {
                      const isEditing = editingId === category.id;
                      return (
                        <TableRow key={category.id} className={isEditing ? "bg-muted/30" : undefined}>
                          <TableCell className="font-medium">
                            {isEditing ? (
                              <Input
                                ref={editInputRef}
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveEdit();
                                  if (e.key === "Escape") handleCancelEdit();
                                }}
                                className="h-8 text-sm"
                              />
                            ) : (
                              category.name
                            )}
                          </TableCell>

                          <TableCell>
                            {!isEditing && (
                              <Badge variant="secondary">
                                {category.product_count || 0} producto
                                {category.product_count !== 1 ? "s" : ""}
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell className="text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleSaveEdit}
                                  disabled={!editingName.trim()}
                                  className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                                  title="Guardar cambios"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleCancelEdit}
                                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                  title="Cancelar edición"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleStartEdit(category)}
                                  className="h-8 w-8 p-0"
                                  title="Editar categoría"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteClick(category)}
                                  className="h-8 w-8 p-0 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                                  title="Eliminar categoría"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 pt-4 border-t flex gap-3 shrink-0">
            <Button variant="outline" onClick={handleClose} className="flex-1 h-11">
              Cerrar
            </Button>
          </div>
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
        isLoading={isDeleting}
      />
    </>
  );
}
