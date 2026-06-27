import React, { useState, useEffect } from "react"
import { Dialog, DialogContent } from "@components/ui/dialog"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { Label } from "@components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select"
import { Switch } from "@components/ui/switch"
import { useCategories } from "@renderer/features/settings"
import { Spinner } from "@components/ui/spinner"
import { capitalizeWords } from "@lib/utils"
import { PackagePlus, Save, Plus, Receipt } from "lucide-react"
import { CategoryManagerDialog } from "./category-manager-dialog"

import { Product } from "@shared/types/models";

type ProductDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  onSave: (product: Product) => void
  isSaving?: boolean
}

export function ProductDialog({ open, onOpenChange, product, onSave, isSaving = false }: ProductDialogProps) {
  const { categories, isLoading: loadingCategories, loadCategories } = useCategories();
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [formData, setFormData] = useState(() => {
    if (product) {
      return {
        name: product.name,
        category_id: (product.category_id || product.category?.id || "").toString(),
        cost_price: (product.cost_price || 0).toString(),
        sale_price: (product.sale_price || 0).toString(),
        stock: (product.stock || 0).toString(),
        sku: product.sku || "",
        min_stock: (product.min_stock || 5).toString(),
        taxable: product.taxable ?? true,
      }
    }
    const defaultCategoryId = categories && categories.length > 0 ? categories[0].id.toString() : "";
    return {
      name: "",
      category_id: defaultCategoryId,
      cost_price: "",
      sale_price: "",
      stock: "",
      sku: "",
      min_stock: "2",
      taxable: true,
    }
  })

  useEffect(() => {
    const handleCategoriesUpdated = () => loadCategories();
    window.addEventListener('categories-updated', handleCategoriesUpdated);
    return () => window.removeEventListener('categories-updated', handleCategoriesUpdated);
  }, [loadCategories]);

  // Keep the category_id in sync if it's empty and categories just loaded
  useEffect(() => {
    if (!product && !formData.category_id && categories.length > 0) {
      void Promise.resolve().then(() => {
        setFormData(prev => ({ ...prev, category_id: categories[0].id.toString() }));
      });
    }
  }, [categories, product, formData.category_id]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: id === 'name' ? capitalizeWords(value) : value,
    }));
  };

  const handleCategoryChange = (value: string) => {
    setFormData((prev) => ({ ...prev, category_id: value }));
  };

  const handleSave = () => {
    const data: Partial<Product> = {
      name: formData.name,
      category_id: formData.category_id || undefined,
      category: null,
      cost_price: Number.parseFloat(formData.cost_price) || 0,
      sale_price: Number.parseFloat(formData.sale_price) || 0,
      stock: Number.parseInt(formData.stock) || 0,
      sku: formData.sku,
      min_stock: Number.parseInt(formData.min_stock) || 5,
      taxable: formData.taxable,
    };

    if (product?.id) data.id = product.id;

    onSave(data as Product);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
          {/* Header */}
          <div className="p-6 pb-4 border-b space-y-1">
            <h2 className="text-xl font-semibold tracking-tight">
              {product ? "Editar Producto" : "Agregar Producto"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {product ? "Modifica los detalles del producto" : "Completa la información del nuevo producto"}
            </p>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del Producto</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Ej: Producto Genérico"
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sku">SKU / Código</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={handleChange}
                placeholder="Ej: COD-12345"
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="taxable" className="text-sm font-medium">Gravado con ITBIS (18%)</Label>
                    <p className="text-xs text-muted-foreground">Desactivar si el producto está exento</p>
                  </div>
                </div>
                <Switch
                  id="taxable"
                  checked={formData.taxable}
                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, taxable: checked }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoría</Label>
              <div className="flex gap-2">
                {loadingCategories ? (
                  <div className="flex flex-1 items-center justify-center h-9 border rounded-md">
                    <Spinner className="size-4" />
                  </div>
                ) : (
                  <Select value={formData.category_id} onValueChange={handleCategoryChange} disabled={isSaving}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecciona una categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setCategoryManagerOpen(true)}
                  disabled={isSaving}
                  title="Gestionar categorías"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost_price">Precio de Compra ($)</Label>
                <Input
                  id="cost_price"
                  type="number"
                  step="0.01"
                  value={formData.cost_price}
                  onChange={handleChange}
                  placeholder="0.00"
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sale_price">Precio de Venta ($)</Label>
                <Input
                  id="sale_price"
                  type="number"
                  step="0.01"
                  value={formData.sale_price}
                  onChange={handleChange}
                  placeholder="0.00"
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stock">Stock</Label>
                <Input
                  id="stock"
                  type="number"
                  value={formData.stock}
                  onChange={handleChange}
                  placeholder="0"
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min_stock">Alerta de Stock Bajo</Label>
                <Input
                  id="min_stock"
                  type="number"
                  value={formData.min_stock}
                  onChange={handleChange}
                  placeholder="5"
                  disabled={isSaving}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 pt-4 border-t flex gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="flex-1 h-11"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.name || !formData.cost_price || !formData.sale_price || !formData.stock || isSaving}
              className="flex-1 h-11"
            >
              {isSaving ? 'Guardando...' : product ? (
                <><Save className="h-4 w-4" />Guardar Cambios</>
              ) : (
                <><PackagePlus className="h-4 w-4" />Agregar Producto</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CategoryManagerDialog
        open={categoryManagerOpen}
        onOpenChange={setCategoryManagerOpen}
        onCategoriesChanged={() => {
          loadCategories().then(() => {
            if (categories.length > 0) {
              const last = categories[categories.length - 1];
              setFormData(prev => ({ ...prev, category_id: last.id.toString() }));
            }
          });
        }}
      />
    </>
  )
}
