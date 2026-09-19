import { Product } from "@shared/types/models";

/**
 * Códigos escaneables de un producto para mostrar en listas: el código de
 * barras principal (o el SKU si no tiene) y cuántos códigos más reconoce el POS.
 */
export function productCodeSummary(product: Product) {
  const all = [product.barcode, ...(product.barcodes ?? []).map((b) => b.code), product.sku]
    .filter((c): c is string => !!c);
  const unique = [...new Set(all)];
  return {
    primary: unique[0] ?? null,
    extraCount: Math.max(0, unique.length - 1),
    /** Para el tooltip: todos los códigos, uno por línea. */
    title: unique.length > 0 ? unique.join("\n") : undefined,
  };
}
