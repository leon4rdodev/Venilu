# Modulo: categorias

## Responsabilidad

Clasifica productos y permite reportar conteo de productos por categoria.

## Archivos principales

| Archivo | Rol |
| --- | --- |
| `src/main/modules/categories/entities/category.entity.ts` | Entidad `Category` |
| `src/main/modules/categories/services/categories.service.ts` | CRUD y conteos |
| `src/main/modules/categories/categories.ipc.ts` | IPC |
| `src/renderer/features/settings/hooks/use-categories.ts` | Estado en renderer |
| `src/renderer/features/inventory/components/category-manager-dialog.tsx` | UI de gestion |

## Reglas

- Lectura requiere autenticacion.
- Crear, actualizar y eliminar requiere admin.
- Al eliminar categoria, los productos relacionados quedan con categoria null por `onDelete: SET NULL` en `Product`.

## IPC

- `get-categories`
- `get-categories-with-count`
- `create-category`
- `update-category`
- `delete-category`

