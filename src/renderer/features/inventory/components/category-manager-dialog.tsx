import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@components/ui/dialog";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Pencil, Trash2, Check, X, Plus, Tags } from "lucide-react";
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
          <div className="p-6 pb-4 border-b border-border space-y-4 shrink-0">
            <div className="space-y-1">
              <DialogTitle className="text-lg font-semibold tracking-tight">Gestionar Categorías</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Crea, edita o elimina categorías para organizar tu inventario
              </DialogDescription>
            </div>
            {/* New category input — fixed in header */}
            <div className="space-y-2">
              <Label htmlFor="new-category">Nueva categoría</Label>
              <div className="flex gap-2">
                <Input
                  id="new-category"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej: Bebidas"
                  disabled={isCreating}
                  autoComplete="off"
                  className="h-9 bg-background"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") setNewName("");
                  }}
                />
                <Button
                  type="button"
                  onClick={handleCreate}
                  disabled={isCreating || !newName.trim()}
                  aria-busy={isCreating}
                  className="shrink-0 h-9 gap-1.5"
                >
                  <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                  {isCreating ? "Creando..." : "Agregar"}
                </Button>
              </div>
            </div>
          </div>

          {/* Body — scrollable */}
          <div className="flex-1 overflow-y-auto min-h-0 p-6">
            <div className="border border-border rounded-lg overflow-hidden">
              {categories.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-1">
                    <Tags className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.5} aria-hidden="true" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No hay categorías creadas aún</p>
                  <p className="text-sm text-muted-foreground max-w-[260px]">
                    Escribe un nombre arriba y pulsa «Agregar» para crear la primera.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border" aria-label="Categorías">
                  {categories.map((category) => {
                    const isEditing = editingId === category.id;
                    return (
                      <li
                        key={category.id}
                        className={`flex items-center gap-3 px-4 py-3 ${
                          isEditing ? "bg-muted/30" : "hover:bg-muted/30"
                        } transition-colors`}
                      >
                        {isEditing ? (
                          <>
                            <Input
                              ref={editInputRef}
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveEdit();
                                if (e.key === "Escape") handleCancelEdit();
                              }}
                              aria-label={`Nuevo nombre para ${category.name}`}
                              autoComplete="off"
                              className="h-8 text-sm bg-background flex-1"
                            />
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleSaveEdit}
                                disabled={!editingName.trim()}
                                className="h-8 w-8 p-0 text-foreground"
                                title="Guardar cambios"
                                aria-label="Guardar cambios"
                              >
                                <Check className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleCancelEdit}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                title="Cancelar edición"
                                aria-label="Cancelar edición"
                              >
                                <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                              </Button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex-1 min-w-0 flex items-center gap-2">
                              <span className="text-sm font-medium truncate" title={category.name}>{category.name}</span>
                              <span className="rounded-full text-xs font-medium px-2 py-0.5 bg-muted text-muted-foreground shrink-0 tabular-nums">
                                {category.product_count || 0} producto
                                {category.product_count !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleStartEdit(category)}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                title="Editar categoría"
                                aria-label={`Editar categoría ${category.name}`}
                              >
                                <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClick(category)}
                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                title="Eliminar categoría"
                                aria-label={`Eliminar categoría ${category.name}`}
                              >
                                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                              </Button>
                            </div>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 pt-4 border-t border-border flex gap-3 shrink-0">
            <Button variant="outline" onClick={handleClose} className="flex-1 h-10">
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
