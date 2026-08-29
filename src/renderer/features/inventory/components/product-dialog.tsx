import React, { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent } from "@components/ui/dialog"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { Label } from "@components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select"
import { Switch } from "@components/ui/switch"
import { useCategories } from "@renderer/features/settings"
import { Skeleton } from "@components/ui/skeleton"
import { capitalizeWords } from "@lib/utils"
import { fileToCompressedWebP, productImageSrc } from "@lib/image"
import { toast } from "sonner"
import { PackagePlus, Save, Plus, ImagePlus, X } from "lucide-react"
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
        itbis_exempt: product.itbis_exempt ?? false,
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
      min_stock: "5",
      itbis_exempt: false,
    }
  })

  // Product photo: undefined = untouched, data URL = new image, null = removed
  const [imageData, setImageData] = useState<string | null | undefined>(undefined);
  const [imagePreview, setImagePreview] = useState<string | undefined>(
    product?.image ? productImageSrc(product.image) : undefined
  );
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleCategoriesUpdated = () => loadCategories();
    window.addEventListener('categories-updated', handleCategoriesUpdated);
    return () => window.removeEventListener('categories-updated', handleCategoriesUpdated);
  }, [loadCategories]);

  // Re-sync the form whenever the dialog opens for a (possibly different)
  // product — the component stays mounted between opens.
  useEffect(() => {
    if (!open) return;
    setImageData(undefined);
    setImagePreview(product?.image ? productImageSrc(product.image) : undefined);
    setFormData(
      product
        ? {
            name: product.name,
            category_id: (product.category_id || product.category?.id || "").toString(),
            cost_price: (product.cost_price || 0).toString(),
            sale_price: (product.sale_price || 0).toString(),
            stock: (product.stock || 0).toString(),
            sku: product.sku || "",
            min_stock: (product.min_stock || 5).toString(),
            itbis_exempt: product.itbis_exempt ?? false,
          }
        : {
            name: "",
            category_id: categories.length > 0 ? categories[0].id.toString() : "",
            cost_price: "",
            sale_price: "",
            stock: "",
            sku: "",
            min_stock: "5",
            itbis_exempt: false,
          }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product]);

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

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;

    setIsCompressing(true);
    try {
      // Auto-converts to WebP and compresses before it ever leaves the renderer
      const webp = await fileToCompressedWebP(file);
      setImageData(webp);
      setImagePreview(webp);
    } catch (err) {
      toast.error("No se pudo procesar la imagen", { description: (err as Error).message });
    } finally {
      setIsCompressing(false);
    }
  };

  const handleImageRemove = () => {
    // null = explicitly remove the stored image; undefined = never touched
    setImageData(product?.image ? null : undefined);
    setImagePreview(undefined);
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
      itbis_exempt: formData.itbis_exempt,
    };

    if (imageData !== undefined) data.image = imageData;
    if (product?.id) data.id = product.id;

    onSave(data as Product);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="p-6 pb-4 border-b border-border space-y-1 shrink-0">
            <h2 className="text-lg font-semibold tracking-tight">
              {product ? "Editar Producto" : "Agregar Producto"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {product ? "Modifica los detalles del producto" : "Completa la información del nuevo producto"}
            </p>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4 flex-1 overflow-y-auto min-h-0">
            {/* Product photo — auto-converted to compressed WebP */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Foto del Producto</Label>
              <div className="flex items-start gap-4">
                <div className="h-24 w-24 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Vista previa" className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} />
                  )}
                </div>
                <div className="flex flex-col gap-2 min-w-0 pt-1">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9"
                      disabled={isSaving || isCompressing}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {isCompressing ? "Procesando..." : imagePreview ? "Cambiar foto" : "Subir foto"}
                    </Button>
                    {imagePreview && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 text-muted-foreground hover:text-destructive"
                        disabled={isSaving || isCompressing}
                        onClick={handleImageRemove}
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Quitar
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Se convierte a WebP y se comprime automáticamente.
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nombre del Producto</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Ej: Producto Genérico"
                disabled={isSaving}
                className="h-9 bg-background"
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
                className="h-9 bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoría</Label>
              <div className="flex gap-2">
                {loadingCategories ? (
                  <Skeleton className="flex-1 h-9 rounded-md" />
                ) : (
                  <Select value={formData.category_id} onValueChange={handleCategoryChange} disabled={isSaving}>
                    <SelectTrigger className="flex-1 bg-background">
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
                  <Plus className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
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
                  className="h-9 bg-background"
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
                  className="h-9 bg-background"
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
                  className="h-9 bg-background"
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
                  className="h-9 bg-background"
                />
              </div>
            </div>

            {/* Exención de ITBIS (fiscal RD) */}
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3.5">
              <div className="min-w-0 space-y-0.5">
                <Label htmlFor="itbis_exempt" className="text-sm font-medium">Exento de ITBIS</Label>
                <p className="text-xs text-muted-foreground">
                  Actívalo solo para productos exentos según la DGII (víveres básicos, medicinas...).
                </p>
              </div>
              <Switch
                id="itbis_exempt"
                checked={formData.itbis_exempt}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, itbis_exempt: checked }))
                }
                disabled={isSaving}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 pt-4 border-t border-border flex gap-3 shrink-0">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="flex-1 h-10"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.name || !formData.cost_price || !formData.sale_price || !formData.stock || isSaving}
              className="flex-1 h-10"
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
        onCategoriesChanged={() => { void loadCategories(); }}
      />
    </>
  )
}
