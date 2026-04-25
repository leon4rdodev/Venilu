# Modulo: ventas

## Responsabilidad

Procesa ventas, guarda items vendidos, descuenta stock, maneja ventas a credito y registra pagos de deuda.

## Archivos principales

| Archivo | Rol |
| --- | --- |
| `src/main/modules/sales/entities/sale.entity.ts` | Entidad `Sale` |
| `src/main/modules/sales/entities/sale-item.entity.ts` | Entidad `SaleItem` |
| `src/main/modules/sales/entities/debt-payment.entity.ts` | Entidad `DebtPayment` |
| `src/main/modules/sales/services/sales.service.ts` | Reglas y transacciones |
| `src/main/modules/sales/sales.ipc.ts` | IPC |
| `src/renderer/features/pos/hooks/use-cart.ts` | Carrito y proceso de venta |

## Flujo de venta

1. Renderer envia `saleData` y `saleItems`.
2. Servicio valida que existan items.
3. Servicio valida turno abierto.
4. Si el metodo es credito, valida cliente.
5. Si hay limite de credito, valida nuevo balance.
6. Inicia transaccion.
7. Valida cada producto y stock disponible.
8. Descuenta stock.
9. Crea `SaleItem` con snapshot de nombre y precio.
10. Calcula subtotal, descuento y total final.
11. Genera ID corto unico.
12. Guarda `Sale` con items en cascade.
13. Si es credito, aumenta balance del cliente.

## Pagos de deuda

Los pagos:

- Requieren monto mayor que cero.
- No pueden exceder la deuda actual.
- Reducen `Customer.balance`.
- Crean `DebtPayment`.
- Se aplican FIFO a ventas con estado `credit` o `partial`.

## IPC

- `process-sale`
- `get-sales`
- `get-recent-sales`
- `get-sale-items`
- `pay-customer-debt`
- `get-customer-sales`

## Riesgo a corregir

`process-sale`, `get-sales`, `get-recent-sales` y `get-sale-items` no validan sesion actualmente. Deben usar `requireAuth`.

