

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCategories } from "@/hooks/use-categories"
import { Spinner } from "../ui/spinner"
import { capitalizeWords } from "@/lib/utils"

import { Product } from "@/types";

type ProductDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  onSave: (product: Product) => void
  isSaving?: boolean
}

export function ProductDialog({ open, onOpenChange, product, onSave, isSaving = false }: ProductDialogProps) {
  const { categories, isLoading: loadingCategories, loadCategories } = useCategories();
  const [formData, setFormData] = useState({
    name: "",
    category_id: "",
    purchase_price: "",
    sale_price: "",
    stock: "",
    sku: "",
    min_stock: "2",
  })

  // Listen for category updates from inventory-table
  useEffect(() => {
    const handleCategoriesUpdated = () => {
      loadCategories();
    };

    window.addEventListener('categories-updated', handleCategoriesUpdated);

    return () => {
      window.removeEventListener('categories-updated', handleCategoriesUpdated);
    };
  }, [loadCategories]);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        category_id: product.category_id.toString(),
        purchase_price: product.purchase_price.toString(),
        sale_price: product.sale_price.toString(),
        stock: product.stock.toString(),
        sku: product.sku || "",
        min_stock: (product.min_stock || 5).toString(),
      })
    } else {
      // Set first category as default when creating new product
      const defaultCategoryId = categories.length > 0 ? categories[0].id.toString() : "";
      setFormData({
        name: "",
        category_id: defaultCategoryId,
        purchase_price: "",
        sale_price: "",
        stock: "",
        sku: "",
        min_stock: "2",
      })
    }
  }, [product, open, categories])

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
    onSave({
      id: product?.id || 0,
      name: formData.name,
      category_id: Number.parseInt(formData.category_id),
      category: "", // This will be populated by the backend
      purchase_price: Number.parseFloat(formData.purchase_price),
      sale_price: Number.parseFloat(formData.sale_price),
      stock: Number.parseInt(formData.stock),
      sku: formData.sku,
      min_stock: Number.parseInt(formData.min_stock) || 5,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{product ? "Editar Producto" : "Agregar Producto"}</DialogTitle>
          <DialogDescription>
            {product ? "Modifica los detalles del producto" : "Completa la información del nuevo producto"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
              <Label htmlFor="category">Categoría</Label>
              {loadingCategories ? (
                <div className="flex items-center justify-center h-10 border rounded-md">
                  <Spinner className="size-4" />
                </div>
              ) : (
                <Select value={formData.category_id} onValueChange={handleCategoryChange} disabled={isSaving}>
                  <SelectTrigger>
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
            </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="purchase_price">Precio de Compra ($)</Label>
              <Input
                id="purchase_price"
                type="number"
                step="0.01"
                value={formData.purchase_price}
                onChange={handleChange}
                placeholder="0.00"
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
              />
            </div>
          </div>

            <div className="space-y-2">
              <Label htmlFor="stock">Stock</Label>
              <Input
                id="stock"
                type="number"
                value={formData.stock}
                onChange={handleChange}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="min_stock">Alerta de Stock Bajo (Cantidad)</Label>
              <Input
                id="min_stock"
                type="number"
                value={formData.min_stock}
                onChange={handleChange}
                placeholder="5"
              />
            </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={!formData.name || !formData.purchase_price || !formData.sale_price || !formData.stock || isSaving}
          >
            {isSaving ? 'Guardando...' : (product ? "Guardar Cambios" : "Agregar Producto")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
