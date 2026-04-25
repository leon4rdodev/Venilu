# Modulo: productos

## Responsabilidad

Gestiona inventario, stock, precios, SKU, codigo de barra, categoria y alertas de bajo stock.

## Archivos principales

| Archivo | Rol |
| --- | --- |
| `src/main/modules/products/entities/product.entity.ts` | Entidad `Product` |
| `src/main/modules/products/services/products.service.ts` | Consultas, CRUD, stats |
| `src/main/modules/products/products.ipc.ts` | IPC |
| `src/renderer/features/inventory/hooks/use-products.ts` | Estado de inventario |
| `src/renderer/features/pos/hooks/use-pos-products.ts` | Productos para POS |

## Reglas

- Lectura requiere usuario autenticado.
- Crear, actualizar y eliminar requiere admin.
- `category_id` vacio se convierte a null.
- Un producto con ventas asociadas no debe eliminarse.
- Bajo stock: `stock <= min_stock` y `stock > 0`.
- Sin stock: `stock = 0`.

## IPC

- `get-products`
- `get-products-for-pos`
- `create-product`
- `update-product`
- `delete-product`
- `get-low-stock-products`
- `get-inventory-stats`

## Notas tecnicas

`findAll` pagina resultados y limita `pageSize` entre 10 y 100. El sort usa allowlist para reducir riesgo de SQL injection.

