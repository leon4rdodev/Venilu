# Modulo: clientes

## Responsabilidad

Administra clientes, datos de contacto, notas, balance, limite de credito, historial de ventas y pagos.

## Archivos principales

| Archivo | Rol |
| --- | --- |
| `src/main/modules/customers/entities/customer.entity.ts` | Entidad `Customer` |
| `src/main/modules/customers/services/customers.service.ts` | CRUD, busqueda, stats |
| `src/main/modules/customers/customers.ipc.ts` | IPC |
| `src/renderer/features/customers/hooks/use-customers.ts` | Estado de clientes |
| `src/renderer/features/pos/components/customer-selector.tsx` | Seleccion en POS |

## Reglas

- Crear cliente requiere nombre.
- Admin y employee pueden crear/actualizar clientes.
- Solo admin puede eliminar clientes.
- Balance positivo representa deuda.
- `credit_limit` null significa credito ilimitado.

## IPC

- `get-customers`
- `search-customers`
- `create-customer`
- `update-customer`
- `delete-customer`
- `get-customer-stats`
- `customers:getSales`
- `customers:getPayments`

