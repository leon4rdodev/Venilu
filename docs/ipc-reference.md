# Referencia IPC

## Convenciones

Los handlers devuelven normalmente:

```ts
{
  success: boolean;
  message?: string;
  data?: T;
}
```

Algunos endpoints historicos devuelven estructuras especificas. Revisar la tabla antes de consumir un canal nuevo.

## Sesion

| Canal | Permiso | Payload | Respuesta |
| --- | --- | --- | --- |
| `set-logged-in-user` | Publico local | `User` | `{ success }` |
| `logout` | Publico local | ninguno | `{ success }` |

Nota: actualmente `set-logged-in-user` acepta el usuario enviado por renderer. Para mayor seguridad, el main deberia setear la sesion directamente dentro de `login-request` y validar contra base de datos al restaurar.

## Usuarios

| Canal | Permiso | Descripcion |
| --- | --- | --- |
| `login-request` | Publico | Verifica credenciales |
| `get-users` | Admin | Lista usuarios |
| `create-user` | Admin o onboarding inicial | Crea usuario |
| `update-user` | Admin | Actualiza usuario |
| `delete-user` | Admin | Elimina usuario |
| `onboarding:check` | Publico | Verifica si existe admin |

## Productos

| Canal | Permiso | Descripcion |
| --- | --- | --- |
| `get-products` | Auth | Lista productos paginados |
| `get-products-for-pos` | Auth | Lista productos para POS |
| `create-product` | Admin | Crea producto |
| `update-product` | Admin | Actualiza producto |
| `delete-product` | Admin | Elimina producto |
| `get-low-stock-products` | Auth | Productos bajo stock |
| `get-inventory-stats` | Auth | Metricas de inventario |

## Categorias

| Canal | Permiso | Descripcion |
| --- | --- | --- |
| `get-categories` | Auth | Lista categorias |
| `get-categories-with-count` | Auth | Categorias con conteo de productos |
| `create-category` | Admin | Crea categoria |
| `update-category` | Admin | Actualiza categoria |
| `delete-category` | Admin | Elimina categoria |

## Ventas

| Canal | Permiso actual | Descripcion |
| --- | --- | --- |
| `process-sale` | Sin `requireAuth` actual | Procesa venta |
| `get-sales` | Sin `requireAuth` actual | Lista ventas recientes |
| `get-recent-sales` | Sin `requireAuth` actual | Ultimas ventas |
| `get-sale-items` | Sin `requireAuth` actual | Items de una venta |
| `pay-customer-debt` | Auth | Registra abono de cliente |
| `get-customer-sales` | Auth | Ventas de un cliente |

Recomendacion: agregar `requireAuth` a los cuatro canales marcados como sin proteccion.

## Turnos

| Canal | Permiso | Descripcion |
| --- | --- | --- |
| `shifts:getActive` | Auth | Turno activo del usuario |
| `shifts:open` | Auth | Abre turno |
| `shifts:close` | Auth | Cierra turno |
| `shifts:getSales` | Auth | Ventas del turno |
| `history:get` | Auth | Historial; admin ve todo, employee solo propio |
| `shifts:getDebtPayments` | Auth | Abonos del turno |
| `shifts:forceClose` | Admin | Cierre forzado |

## Clientes

| Canal | Permiso | Descripcion |
| --- | --- | --- |
| `get-customers` | Auth | Lista clientes |
| `search-customers` | Auth | Busca clientes |
| `create-customer` | Auth | Crea cliente |
| `update-customer` | Auth | Actualiza cliente |
| `delete-customer` | Admin | Elimina cliente |
| `get-customer-stats` | Auth | Metricas de clientes |
| `customers:getSales` | Auth | Ventas paginadas de cliente |
| `customers:getPayments` | Auth | Pagos paginados de cliente |

## Settings y logo

| Canal | Permiso actual | Descripcion |
| --- | --- | --- |
| `settings:get` | Auth | Lee configuracion |
| `settings:update` | Admin o onboarding | Actualiza configuracion |
| `upload-logo` | Sin `requireAuth` actual | Guarda logo en `userData` |
| `get-logo` | Sin `requireAuth` actual | Lee logo |
| `delete-logo` | Sin `requireAuth` actual | Elimina logo |

Recomendacion: proteger escritura y borrado de logo con admin u onboarding.

## Reportes

| Canal | Permiso | Descripcion |
| --- | --- | --- |
| `get-total-sales-metrics` | Admin | Metricas comparativas |
| `get-top-selling-products` | Admin | Productos mas vendidos |
| `get-sales-over-time` | Admin | Serie temporal |
| `get-least-selling-products` | Admin | Productos menos vendidos |
| `get-dashboard-stats` | Admin | Resumen del dashboard |
| `generate-sales-report-pdf` | Admin | Exporta PDF |

Advertencia: el renderer invoca `clear-reports-cache`, pero no existe handler registrado.

## Backups

| Canal | Permiso actual | Descripcion |
| --- | --- | --- |
| `backup:create` | Sin `requireAuth` actual | Crea backup |
| `backup:list` | Sin `requireAuth` actual | Lista backups |
| `backup:restore` | Sin `requireAuth` actual | Restaura backup |
| `backup:delete` | Sin `requireAuth` actual | Elimina backup |

Advertencia: el renderer invoca `backup:export`, pero no existe handler registrado.

## Printer y updater

| Canal | Permiso actual | Descripcion |
| --- | --- | --- |
| `get-printers` | Sin `requireAuth` actual | Lista impresoras |
| `print-receipt` | Sin `requireAuth` actual | Imprime recibo |
| `test-print` | Sin `requireAuth` actual | Placeholder |
| `updater:install-now` | Sin `requireAuth` actual | Reinicia e instala update |

Eventos enviados por updater:

- `updater:checking`
- `updater:update-available`
- `updater:up-to-date`
- `updater:download-progress`
- `updater:update-downloaded`
- `updater:error`

