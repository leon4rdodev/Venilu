# Vision general

## Proposito

Venilu es un sistema POS local-first para escritorio. Su objetivo es permitir que un negocio opere ventas, caja, inventario, clientes, credito, reportes y configuracion sin depender de una API externa.

## Capacidades del producto

| Area | Capacidades |
| --- | --- |
| Autenticacion | Login local, roles `admin` y `employee`, onboarding inicial |
| Punto de venta | Carrito, control de stock, metodos de pago, descuentos, recibos |
| Turnos | Apertura, cierre, caja esperada, diferencia, cierre forzado admin |
| Inventario | Productos, categorias, SKU, codigo de barra, stock minimo |
| Clientes | Datos de contacto, balance, limite de credito, historial y pagos |
| Credito | Venta a credito, deuda acumulada, abonos aplicados a ventas pendientes |
| Suplidores | Proveedores, compras que entran al inventario, cuentas por pagar y pagos |
| Reportes | Metricas, productos mas/menos vendidos, ventas por periodo, PDF |
| Configuracion | Datos del negocio, moneda, impresora, papel, logo |
| Backups | Crear, listar, restaurar y eliminar copias SQLite |
| Actualizaciones | Integracion con `electron-updater` en produccion |

## Principios de diseno actuales

- Aplicacion local con base de datos SQLite por usuario del sistema operativo.
- Separacion entre proceso main y renderer mediante IPC.
- Reglas criticas de negocio en servicios del proceso main.
- UI organizada por `features` y `pages`.
- Tipos de dominio compartidos en `src/shared/types`.
- Roles simples: administrador y empleado.

## Flujo funcional basico

1. El usuario inicia la app Electron.
2. El proceso main inicializa TypeORM y registra handlers IPC.
3. El renderer verifica si el onboarding esta completo.
4. Si no existe admin, se muestra onboarding.
5. El usuario inicia sesion.
6. El main guarda la sesion activa en memoria.
7. Para vender, el usuario abre un turno.
8. El POS procesa ventas por IPC.
9. El servicio de ventas valida turno, cliente, stock y credito.
10. La venta se guarda en una transaccion y descuenta inventario.
11. El turno puede cerrarse calculando caja esperada.

