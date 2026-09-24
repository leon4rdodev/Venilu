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
import { capitalizeWords, cn } from "@lib/utils"
import { fileToCompressedWebP, productImageSrc } from "@lib/image"
import { formatCurrency } from "@lib/currency"
import { ipc } from "@lib/ipc"
import { toast } from "sonner"
import { PackagePlus, Save, Plus, ImagePlus, X, Layers, Package, Pencil, Tag, DollarSign, Boxes, Barcode } from "lucide-react"
import { CategoryManagerDialog } from "./category-manager-dialog"
import { BarcodeListInput } from "./barcode-list-input"
import { UNITS, formatQty, unitDef } from "@shared/units"

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

/** Todos los códigos de barras del producto: el principal primero, luego los adicionales. */
function productBarcodes(product: Product | null): string[] {
  if (!product) return [];
  const codes = [product.barcode, ...(product.barcodes ?? []).map((b) => b.code)];
  return [...new Set(codes.filter((c): c is string => !!c))];
}

/** Encabezado de sección del formulario: icono + título + ayuda opcional a la derecha. */
function SectionHeading({ icon: Icon, title, hint }: { icon: React.ElementType; title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
        {title}
      </h3>
      {hint && <span className="text-xs text-muted-foreground text-right min-w-0">{hint}</span>}
    </div>
  );
}

/** Estado inicial del formulario según el modo (editar / crear / crear presentación). */
function buildFormState(product: Product | null, variantParent: Product | null | undefined, categories: Category[]) {
  if (product) {
    return {
      name: product.name,
      category_id: (product.category_id || product.category?.id || "").toString(),
      cost_price: (product.cost_price || 0).toString(),
      sale_price: (product.sale_price || 0).toString(),
      stock: String(product.stock || 0),
      sku: product.sku || "",
      min_stock: (product.min_stock ?? 5).toString(), // 0 es válido: sin alerta de stock bajo
      itbis_exempt: product.itbis_exempt ?? false,
      variant_name: product.variant_name || "",
      unit: product.unit || "unidad",
    }
  }
  if (variantParent) {
    // Nueva presentación: hereda nombre (como prefijo), categoría, exención
    // de ITBIS y unidad de medida ("Caja x24" de un producto por libra sigue
    // midiendo en libras).
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
      unit: variantParent.unit || "unidad",
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
    unit: "unidad",
  }
}

export function ProductDialog({ open, onOpenChange, product, onSave, isSaving = false, variantParent = null, onEditVariant, onAddVariant }: ProductDialogProps) {
  const { categories, isLoading: loadingCategories, loadCategories } = useCategories();
  const queryClient = useQueryClient();
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [formData, setFormData] = useState(() => buildFormState(product, variantParent, categories))
  const [barcodes, setBarcodes] = useState<string[]>(() => productBarcodes(product))

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
  const nameRef = useRef<HTMLInputElement>(null);

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
    setBarcodes(productBarcodes(product));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product, variantParent]);

  // Al crear, el cursor arranca en el nombre: el primer paso siempre es nombrar.
  useEffect(() => {
    if (!open || product) return;
    const id = setTimeout(() => nameRef.current?.focus(), 60);
    return () => clearTimeout(id);
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

  const handleUnitChange = (value: string) => {
    setFormData((prev) => ({ ...prev, unit: value }));
  };

  // Reglas dinámicas según la unidad elegida: 'unidad' pide enteros;
  // las medidas fraccionables aceptan decimales en stock y mínimo.
  const selectedUnit = unitDef(formData.unit);
  const stockStep = selectedUnit.integerOnly ? "1" : "0.01";
  const stockInputMode = selectedUnit.integerOnly ? ("numeric" as const) : ("decimal" as const);

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
    const minStock = Number.parseFloat(String(formData.min_stock).replace(",", "."));
    const data: Partial<Product> = {
      name: formData.name,
      category_id: formData.category_id || undefined,
      category: null,
      unit: formData.unit || "unidad",
      cost_price: Number.parseFloat(formData.cost_price) || 0,
      sale_price: Number.parseFloat(formData.sale_price) || 0,
      stock: Number.parseFloat(String(formData.stock).replace(",", ".")) || 0,
      sku: formData.sku,
      // Primer código = principal; el resto son adicionales (set completo)
      barcode: barcodes[0] ?? "",
      extra_barcodes: barcodes.slice(1),
      min_stock: Number.isNaN(minStock) ? 5 : minStock,
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

  // Aviso específico de lo que falta: más claro que un "incompleto" genérico.
  const missingFields = [
    !formData.name.trim() ? "el nombre" : null,
    isVariantMode && !formData.variant_name.trim() ? "el nombre de presentación" : null,
    !formData.cost_price ? "el precio de compra" : null,
    !formData.sale_price ? "el precio de venta" : null,
    !formData.stock ? "el stock" : null,
  ].filter((x): x is string => !!x);
  const isIncomplete = missingFields.length > 0;

  // Margen en vivo: feedback inmediato de la ganancia por cada venta.
  const costNum = Number.parseFloat(formData.cost_price) || 0;
  const saleNum = Number.parseFloat(formData.sale_price) || 0;
  const hasBothPrices = costNum > 0 && saleNum > 0;
  const marginPct = hasBothPrices ? ((saleNum - costNum) / costNum) * 100 : null;
  const belowCost = costNum > 0 && saleNum < costNum;

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
        <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="p-6 pb-4 border-b border-border space-y-1 shrink-0">
            <DialogTitle className="text-lg font-semibold tracking-tight">{title}</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">{subtitle}</DialogDescription>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6 flex-1 overflow-y-auto min-h-0">
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

            {/* ── Información básica + foto ─────────────────────────────── */}
            <section className="space-y-4">
              <SectionHeading icon={Tag} title="Información básica" hint="Opcional salvo el nombre" />
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_152px] gap-4 items-start">
                <div className="space-y-4 min-w-0">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre del Producto</Label>
                    <Input
                      id="name"
                      ref={nameRef}
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

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2 min-w-0">
                      <Label htmlFor="category">Categoría</Label>
                      <div className="flex gap-2">
                        {loadingCategories ? (
                          <Skeleton className="flex-1 h-9 rounded-md" />
                        ) : (
                          <Select value={formData.category_id} onValueChange={handleCategoryChange} disabled={isSaving}>
                            <SelectTrigger id="category" className="flex-1 bg-background min-w-0">
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

                    <div className="space-y-2 min-w-0">
                      <Label htmlFor="unit">Unidad de medida</Label>
                      <Select value={formData.unit} onValueChange={handleUnitChange} disabled={isSaving}>
                        <SelectTrigger id="unit" className="bg-background min-w-0" aria-describedby="unit-hint">
                          <SelectValue placeholder="Unidad" />
                        </SelectTrigger>
                        <SelectContent>
                          {UNITS.map((u) => (
                            <SelectItem key={u.value} value={u.value}>
                              {u.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p id="unit-hint" className="text-xs text-muted-foreground">
                    {selectedUnit.integerOnly
                      ? "Se vende por unidad: cantidades enteras (1, 2, 3…)."
                      : `Precio y stock se miden en ${selectedUnit.plural}: ej. RD$120 la ${selectedUnit.singular}, media = 0.5.`}
                  </p>
                </div>

                {/* Foto — columna lateral, opcional (auto-convertida a WebP) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium leading-none">Foto</p>
                    <span className="text-xs text-muted-foreground">Opcional</span>
                  </div>
                  <div className="aspect-square w-full rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Vista previa de la foto del producto" className="h-full w-full object-cover" />
                    ) : (
                      <ImagePlus className="h-6 w-6 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 w-full"
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
                        className="h-9 w-full text-muted-foreground hover:text-destructive"
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
            </section>

            {/* ── Precios (con margen en vivo) ──────────────────────────── */}
            <section className="space-y-2">
              <SectionHeading icon={DollarSign} title="Precios" hint="Lo que pagas y lo que cobras" />
              <div className="rounded-lg border border-border p-3.5 space-y-3">
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
                    <Label htmlFor="sale_price">
                      Precio de Venta {selectedUnit.integerOnly ? "($)" : `por ${selectedUnit.singular} ($)`}
                    </Label>
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

                {/* Margen en vivo */}
                <p
                  className={cn("text-xs", belowCost ? "text-destructive font-medium" : "text-muted-foreground")}
                  role={belowCost ? "alert" : undefined}
                >
                  {belowCost
                    ? "El precio de venta está por debajo del costo — revisa antes de guardar."
                    : hasBothPrices
                      ? `Margen: ${marginPct!.toFixed(0)}% sobre el costo · ganancia ${formatCurrency(saleNum - costNum)} por ${selectedUnit.integerOnly ? "unidad" : selectedUnit.singular}.`
                      : "Agrega el precio de compra y el de venta para ver el margen de ganancia."}
                </p>

                {/* Exención de ITBIS (fiscal RD) */}
                <div className="flex items-center justify-between gap-4 pt-3 border-t border-border">
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
              </div>
            </section>

            {/* ── Inventario ────────────────────────────────────────────── */}
            <section className="space-y-2">
              <SectionHeading
                icon={Boxes}
                title="Inventario"
                hint={selectedUnit.integerOnly ? undefined : `Se contará en ${selectedUnit.plural}`}
              />
              <div className="rounded-lg border border-border p-3.5 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="stock">
                      Stock {selectedUnit.integerOnly ? "" : `(${selectedUnit.plural})`}
                    </Label>
                    <Input
                      id="stock"
                      type="number"
                      inputMode={stockInputMode}
                      min="0"
                      step={stockStep}
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
                      inputMode={stockInputMode}
                      min="0"
                      step={stockStep}
                      value={formData.min_stock}
                      onChange={handleChange}
                      placeholder="5"
                      disabled={isSaving}
                      aria-describedby="min_stock-hint"
                      className="h-9 bg-background text-right tabular-nums"
                    />
                  </div>
                </div>
                <p id="min_stock-hint" className="text-xs text-muted-foreground">
                  Se marcará como bajo stock al llegar a esta cantidad.
                </p>
              </div>
            </section>

            {/* ── Códigos ───────────────────────────────────────────────── */}
            <section className="space-y-2">
              <SectionHeading icon={Barcode} title="Códigos de venta" hint="Para escanear en el POS" />
              <div className="rounded-lg border border-border p-3.5 space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="barcode-input">Códigos de Barras</Label>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {barcodes.length > 0 ? `${barcodes.length} código${barcodes.length !== 1 ? "s" : ""}` : "Opcional"}
                    </span>
                  </div>
                  <BarcodeListInput value={barcodes} onChange={setBarcodes} disabled={isSaving} />
                </div>
                <div className="space-y-2 sm:max-w-64">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="sku">SKU / Código interno</Label>
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
              </div>
            </section>

            {/* Presentaciones del producto principal en edición */}
            {isEditingPrincipal && (
              <section className="space-y-2">
                <SectionHeading
                  icon={Layers}
                  title="Presentaciones"
                  hint={variants.length > 0
                    ? `${variants.length} ${variants.length === 1 ? "guardada" : "guardadas"}`
                    : undefined}
                />

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
                      const vUnit = unitDef(v.unit);
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
                              {formatQty(v.stock)}
                              {vUnit.value === "unidad" ? " uds" : ` ${vUnit.abbr}`}
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
              </section>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 pt-4 border-t border-border space-y-3 shrink-0">
            {isIncomplete && !isSaving && (
              <p id="product-form-hint" className="text-xs text-muted-foreground text-center">
                Completa {missingFields.join(", ")} para poder guardar.
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
