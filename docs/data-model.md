# Modelo de datos

## Entidades

| Entidad | Tabla | Archivo |
| --- | --- | --- |
| User | `users` | `src/main/modules/users/entities/user.entity.ts` |
| Product | `products` | `src/main/modules/products/entities/product.entity.ts` |
| Category | `categories` | `src/main/modules/categories/entities/category.entity.ts` |
| Sale | `sales` | `src/main/modules/sales/entities/sale.entity.ts` |
| SaleItem | `sale_items` | `src/main/modules/sales/entities/sale-item.entity.ts` |
| DebtPayment | `debt_payments` | `src/main/modules/sales/entities/debt-payment.entity.ts` |
| Shift | `shifts` | `src/main/modules/shifts/entities/shift.entity.ts` |
| Customer | `customers` | `src/main/modules/customers/entities/customer.entity.ts` |
| Setting | `settings` | `src/main/modules/settings/entities/setting.entity.ts` |

## Relaciones

```text
User 1 ── * Shift
User 1 ── * Sale

Category 1 ── * Product

Shift 1 ── * Sale
Shift 1 ── * DebtPayment

Customer 1 ── * Sale
Customer 1 ── * DebtPayment

Sale 1 ── * SaleItem
Product 1 ── * SaleItem
```

## User

| Campo | Tipo | Nota |
| --- | --- | --- |
| `id` | uuid | PK |
| `username` | string | Unico |
| `password` | string | Hash bcrypt |
| `name` | string | Nombre visible |
| `role` | `admin` o `employee` | Default `employee` |
| `created_at` | date | Audit |
| `updated_at` | date | Audit |

## Product

| Campo | Tipo | Nota |
| --- | --- | --- |
| `id` | uuid | PK |
| `name` | string | Indexado |
| `description` | string nullable | Descripcion |
| `sale_price` | decimal | Precio de venta |
| `cost_price` | decimal | Costo |
| `stock` | integer | Existencia |
| `barcode` | string nullable | Indexado |
| `sku` | string nullable | Indexado |
| `min_stock` | integer | Umbral de alerta |
| `image` | string nullable | Base64 o ruta |
| `category_id` | uuid nullable | FK a Category |

## Sale

| Campo | Tipo | Nota |
| --- | --- | --- |
| `id` | string | ID corto generado |
| `user_id` | uuid | FK a User |
| `shift_id` | string nullable | FK a Shift |
| `customer_id` | uuid nullable | FK a Customer |
| `customer_name` | string nullable | Snapshot |
| `subtotal` | decimal | Antes de descuento |
| `discount_amount` | decimal | Descuento |
| `total_amount` | decimal | Total final |
| `amount_paid` | decimal nullable | Monto recibido/pagado |
| `change_given` | decimal nullable | Devuelta |
| `payment_method` | enum | `cash`, `card`, `transfer`, `credit` |
| `status` | enum | `paid`, `credit`, `partial` |
| `created_at` | date | Fecha de venta |

## Reglas de consistencia

- Una venta no puede procesarse sin items.
- Una venta requiere turno abierto.
- Una venta a credito requiere cliente.
- El stock se descuenta dentro de la misma transaccion de venta.
- Si un cliente tiene limite de credito, la nueva deuda no puede excederlo.
- Los pagos de deuda se aplican de la venta pendiente mas antigua a la mas nueva.
- Una categoria eliminada deja productos con `category_id` en null.
- Un producto con ventas asociadas no debe eliminarse.

