import React, { useState, useEffect, useMemo, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@components/ui/dialog"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { Label } from "@components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select"
import { Switch } from "@components/ui/switch"
import { useCategories } from "@renderer/features/settings"
import { Skeleton } from "@components/ui/skeleton"
import { capitalizeWords } from "@lib/utils"
import { fileToCompressedWebP, productImageSrc } from "@lib/image"
import { formatCurrency } from "@lib/currency"
import { ipc } from "@lib/ipc"
import { toast } from "sonner"
import { PackagePlus, Save, Plus, ImagePlus, X, Layers, Package, Pencil } from "lucide-react"
import { CategoryManagerDialog } from "./category-manager-dialog"

import { Product, Category } from "@shared/types/models";

type ProductDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  onSave: (product: Product) => void
  isSaving?: boolean
  /** Padre de la nueva presentación — activa el modo "crear presentación" (con product = null). */
  variantParent?: Product | null
  /** Cambia el producto en edición del dialog a una de sus presentaciones. */
  onEditVariant?: (variant: Product) => void
  /** Reabre el mismo dialog en modo "nueva presentación" del padre dado. */
  onAddVariant?: (parent: Product) => void
}

/** Estado inicial del formulario según el modo (editar / crear / crear presentación). */
function buildFormState(product: Product | null, variantParent: Product | null | undefined, categories: Category[]) {
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
      variant_name: product.variant_name || "",
    }
  }
  if (variantParent) {
    // Nueva presentación: hereda nombre (como prefijo), categoría y exención de ITBIS
    return {
      name: `${variantParent.name} `,
      category_id: (variantParent.category_id || variantParent.category?.id || "").toString(),
      cost_price: "",
      sale_price: "",
      stock: "",
      sku: "",
      min_stock: "5",
      itbis_exempt: variantParent.itbis_exempt ?? false,
      variant_name: "",
    }
  }
  return {
    name: "",
    category_id: categories.length > 0 ? categories[0].id.toString() : "",
    cost_price: "",
    sale_price: "",
    stock: "",
    sku: "",
    min_stock: "5",
    itbis_exempt: false,
    variant_name: "",
  }
}

export function ProductDialog({ open, onOpenChange, product, onSave, isSaving = false, variantParent = null, onEditVariant, onAddVariant }: ProductDialogProps) {
  const { categories, isLoading: loadingCategories, loadCategories } = useCategories();
  const queryClient = useQueryClient();
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [formData, setFormData] = useState(() => buildFormState(product, variantParent, categories))

  // Modos de presentación (variante)
  const isEditingVariant = !!product?.parent_product_id;
  const isCreatingVariant = !product && !!variantParent;
  const isVariantMode = isEditingVariant || isCreatingVariant;
  const isEditingPrincipal = !!product && !product.parent_product_id;
  const parentId = product?.parent_product_id ?? variantParent?.id ?? null;

  // Nombre del padre para el banner — sin IPC extra: usa lo que ya tenemos
  // (prop, relación cargada) o las páginas de productos ya cacheadas.
  const parentName = useMemo(() => {
    if (variantParent) return variantParent.name;
    if (product?.parent?.name) return product.parent.name;
    if (!parentId) return null;
    for (const [, data] of queryClient.getQueriesData<{ products?: Product[] }>({ queryKey: ["products"] })) {
      const hit = data?.products?.find((p) => p.id === parentId);
      if (hit) return hit.name;
    }
    return null;
  }, [variantParent, product, parentId, queryClient]);

  // Presentaciones del producto principal en edición
  const variantsQuery = useQuery({
    queryKey: ["product-variants", product?.id],
    enabled: open && isEditingPrincipal,
    queryFn: async () => {
      const result = (await ipc.invoke("get-product-variants", { productId: product!.id })) as {
        success: boolean; data?: Product[]; message?: string;
      };
      if (!result.success || !result.data) {
        throw new Error(result.message || "Error al cargar presentaciones");
      }
      return result.data;
    },
  });
  const variants = variantsQuery.data ?? [];

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
    setFormData(buildFormState(product, variantParent, categories));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product, variantParent]);

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

    if (isVariantMode) {
      data.parent_product_id = parentId;
      data.variant_name = formData.variant_name.trim();
    }

    if (imageData !== undefined) data.image = imageData;
    if (product?.id) data.id = product.id;

    onSave(data as Product);
  }

  const isIncomplete =
    !formData.name ||
    !formData.cost_price ||
    !formData.sale_price ||
    !formData.stock ||
    (isVariantMode && !formData.variant_name.trim());

  const title = isCreatingVariant
    ? "Agregar Presentación"
    : isEditingVariant
      ? "Editar Presentación"
      : product ? "Editar Producto" : "Agregar Producto";
  const subtitle = isCreatingVariant
    ? "Completa la información de la nueva presentación"
    : isEditingVariant
      ? "Modifica los detalles de la presentación"
      : product ? "Modifica los detalles del producto" : "Completa la información del nuevo producto";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="p-6 pb-4 border-b border-border space-y-1 shrink-0">
            <DialogTitle className="text-lg font-semibold tracking-tight">{title}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">{subtitle}</DialogDescription>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4 flex-1 overflow-y-auto min-h-0">
            {/* Banner de presentación: este producto pertenece a un principal */}
            {isVariantMode && (
              <div className="bg-muted/50 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.75} aria-hidden="true" />
                <span className="min-w-0 truncate" title={`Presentación de ${parentName ?? "producto principal"}`}>
                  Presentación de{" "}
                  <span className="font-semibold">{parentName ?? "producto principal"}</span>
                </span>
              </div>
            )}

            {/* Product photo — auto-converted to compressed WebP */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium leading-none">Foto del Producto</p>
                <span className="text-xs text-muted-foreground">Opcional</span>
              </div>
              <div className="flex items-start gap-4">
                <div className="h-24 w-24 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Vista previa de la foto del producto" className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
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
                      aria-busy={isCompressing}
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
                        <X className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
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
                  aria-hidden="true"
                  tabIndex={-1}
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
                required
                autoComplete="off"
                className="h-9 bg-background"
              />
            </div>

            {/* Nombre de la presentación — solo en modo presentación */}
            {isVariantMode && (
              <div className="space-y-2">
                <Label htmlFor="variant_name">Nombre de presentación</Label>
                <Input
                  id="variant_name"
                  value={formData.variant_name}
                  onChange={handleChange}
                  placeholder="Pequeño 250ml / Caja x24"
                  disabled={isSaving}
                  required
                  autoComplete="off"
                  className="h-9 bg-background"
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="sku">SKU / Código</Label>
                <span className="text-xs text-muted-foreground">Opcional</span>
              </div>
              <Input
                id="sku"
                value={formData.sku}
                onChange={handleChange}
                placeholder="Ej: COD-12345"
                disabled={isSaving}
                autoComplete="off"
                className="h-9 bg-background font-mono"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoría</Label>
              <div className="flex gap-2">
                {loadingCategories ? (
                  <Skeleton className="flex-1 h-9 rounded-md" />
                ) : (
                  <Select value={formData.category_id} onValueChange={handleCategoryChange} disabled={isSaving}>
                    <SelectTrigger id="category" className="flex-1 bg-background">
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
                  aria-label="Gestionar categorías"
                >
                  <Plus className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost_price">Precio de Compra ($)</Label>
                <Input
                  id="cost_price"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={formData.cost_price}
                  onChange={handleChange}
                  placeholder="0.00"
                  disabled={isSaving}
                  required
                  className="h-9 bg-background text-right tabular-nums"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sale_price">Precio de Venta ($)</Label>
                <Input
                  id="sale_price"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={formData.sale_price}
                  onChange={handleChange}
                  placeholder="0.00"
                  disabled={isSaving}
                  required
                  className="h-9 bg-background text-right tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stock">Stock</Label>
                <Input
                  id="stock"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={formData.stock}
                  onChange={handleChange}
                  placeholder="0"
                  disabled={isSaving}
                  required
                  className="h-9 bg-background text-right tabular-nums"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min_stock">Alerta de Stock Bajo</Label>
                <Input
                  id="min_stock"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={formData.min_stock}
                  onChange={handleChange}
                  placeholder="5"
                  disabled={isSaving}
                  aria-describedby="min_stock-hint"
                  className="h-9 bg-background text-right tabular-nums"
                />
                <p id="min_stock-hint" className="text-xs text-muted-foreground">
                  Se marcará como bajo stock al llegar a esta cantidad.
                </p>
              </div>
            </div>

            {/* Exención de ITBIS (fiscal RD) */}
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3.5">
              <div className="min-w-0 space-y-0.5">
                <Label htmlFor="itbis_exempt" className="text-sm font-medium">Exento de ITBIS</Label>
                <p id="itbis_exempt-hint" className="text-xs text-muted-foreground">
                  Actívalo solo para productos exentos según la DGII (víveres básicos, medicinas...).
                </p>
              </div>
              <Switch
                id="itbis_exempt"
                aria-describedby="itbis_exempt-hint"
                checked={formData.itbis_exempt}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, itbis_exempt: checked }))
                }
                disabled={isSaving}
              />
            </div>

            {/* Presentaciones del producto principal en edición */}
            {isEditingPrincipal && (
              <div className="space-y-2 pt-3 border-t border-border">
                <div className="flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                  <h3 className="text-sm font-medium leading-none">Presentaciones</h3>
                  {variants.length > 0 && (
                    <span className="text-xs text-muted-foreground tabular-nums">({variants.length})</span>
                  )}
                </div>

                {variantsQuery.isPending ? (
                  <div className="space-y-2" role="status" aria-busy="true" aria-label="Cargando presentaciones">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full rounded-lg" />
                    ))}
                  </div>
                ) : variantsQuery.isError ? (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2" role="alert">
                    <p className="text-xs text-destructive">No se pudieron cargar las presentaciones.</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0"
                      onClick={() => void variantsQuery.refetch()}
                    >
                      Reintentar
                    </Button>
                  </div>
                ) : variants.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Este producto no tiene presentaciones todavía.
                  </p>
                ) : (
                  <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
                    {variants.map((v) => {
                      const src = productImageSrc(v.image);
                      return (
                        <div key={v.id} className="flex items-center gap-2.5 px-3 py-2">
                          {src ? (
                            <img
                              src={src}
                              alt=""
                              loading="lazy"
                              className="h-8 w-8 rounded-md object-cover border border-border shrink-0"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-md bg-muted/50 border border-border flex items-center justify-center shrink-0" aria-hidden="true">
                              <Package className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-sm font-medium truncate" title={v.name}>{v.name}</span>
                              {v.variant_name && (
                                <span
                                  className="rounded-full bg-muted text-xs px-2 py-0.5 text-muted-foreground whitespace-nowrap shrink-0 max-w-[140px] truncate"
                                  title={v.variant_name}
                                >
                                  {v.variant_name}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground tabular-nums">
                              <span className="font-mono">{formatCurrency(v.sale_price)}</span>
                              {" · "}
                              {v.stock} uds
                            </p>
                          </div>
                          {onEditVariant && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                              title="Editar presentación"
                              aria-label={`Editar presentación ${v.variant_name || v.name}`}
                              disabled={isSaving}
                              onClick={() => onEditVariant({ ...v, parent: product })}
                            >
                              <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {onAddVariant && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full h-9 border-dashed text-muted-foreground hover:text-foreground"
                    disabled={isSaving}
                    onClick={() => onAddVariant(product!)}
                  >
                    <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                    Agregar presentación
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 pt-4 border-t border-border space-y-3 shrink-0">
            {isIncomplete && !isSaving && (
              <p id="product-form-hint" className="text-xs text-muted-foreground text-center">
                {isVariantMode
                  ? "Completa nombre, nombre de presentación, precios y stock para guardar."
                  : "Completa nombre, precios y stock para guardar."}
              </p>
            )}
            <div className="flex gap-3">
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
                disabled={isIncomplete || isSaving}
                aria-describedby={isIncomplete && !isSaving ? "product-form-hint" : undefined}
                className="flex-1 h-10"
              >
                {isSaving ? 'Guardando...' : product ? (
                  <><Save className="h-4 w-4" aria-hidden="true" />Guardar Cambios</>
                ) : (
                  <><PackagePlus className="h-4 w-4" aria-hidden="true" />{isCreatingVariant ? "Agregar Presentación" : "Agregar Producto"}</>
                )}
              </Button>
            </div>
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
