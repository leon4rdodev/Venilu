# Venilu

**Venilu** es un punto de venta (POS) de escritorio, moderno y 100% offline, hecho para colmados y tiendas de República Dominicana. Cubre la operación completa del negocio: ventas de mostrador, fiao con abonos, inventario con kardex, facturación fiscal (NCF, ITBIS, reporte 607), reportes y arqueo de caja. Se vende con licencia perpetua (RD$10,000) o anual, con activación offline firmada criptográficamente.

## Capturas

<!--
TODO: agregar capturas de pantalla
![Punto de venta](docs/screenshots/pos.png)
![Inventario](docs/screenshots/inventario.png)
![Reportes](docs/screenshots/reportes.png)
-->

## Características principales

- **POS de mostrador**: búsqueda instantánea, escáner de código de barras y atajos de teclado (F1 buscar, F2 cobrar, F3 poner en espera, F4 reanudar).
- **Ventas en espera**: aparca una venta a medio cobrar y atiende al siguiente cliente sin perder el carrito.
- **Crédito / fiao**: límite de crédito por cliente, abonos parciales y manejo correcto de la deuda al anular.
- **Facturación fiscal DGII**: comprobantes NCF **B01** (Crédito Fiscal), **B02** (Consumo) y **B04** (Nota de Crédito al anular), desglose de ITBIS incluido en el precio, productos exentos, y export del **reporte 607** para el contador.
- **Suplidores y compras**: ficha de proveedores con días de crédito, compras que entran al inventario (kardex y costo actualizado), cuentas por pagar con vencimientos y pagos que salen del arqueo de caja.
- **Inventario con kardex**: productos con foto, costo/precio, stock mínimo, ajustes de stock con motivo, historial de movimientos (kardex) y etiquetas.
- **Reportes**: ventas por rango de fechas, productos más/menos vendidos, mejores clientes, desglose por método de pago, export a **PDF y CSV**.
- **Arqueo de caja**: apertura de turno con fondo inicial, gastos del turno, y cierre contando por denominaciones con cálculo de la diferencia.
- **Multi-usuario**: roles y permisos granulares por módulo, auditoría de acciones sensibles.
- **Backups automáticos** con restauración desde la app.
- **Licenciamiento offline**: claves firmadas con Ed25519, prueba de 15 días, sin internet ni servidor.

## Stack técnico

Electron + React 19 (Vite, Tailwind, Radix/shadcn) en el renderer; el proceso main actúa de backend local con TypeORM sobre SQLite (WAL) e IPC tipado vía `contextBridge`. Tests con Vitest; empaquetado con electron-builder (Windows NSIS, Linux deb).

## Desarrollo

Requisitos: Node.js 22+ y npm (el `postinstall` compila los módulos nativos con `electron-builder install-app-deps`).

```bash
npm install          # instala y compila sqlite3 nativo
npm run dev          # Vite + Electron en modo desarrollo
npm test             # suite de Vitest
npm run build:linux  # empaquetar .deb
npm run build:win    # empaquetar instalador NSIS
```

Otros comandos útiles: `npm run lint`, `npm run seed` (datos de ejemplo), `npm run build:react` (solo renderer).

## Estructura del proyecto

```text
src/
  main/       Proceso main de Electron: módulos (servicios + IPC), TypeORM, migraciones
  renderer/   Aplicación React: pages y features (pos, inventory, customers, reports, settings…)
  shared/     Tipos, permisos y utilidades de dinero compartidos entre main y renderer
  test/       Setup de tests y mocks (DB sqlite3 en memoria)
scripts/      Herramientas del vendedor (generar-licencia.mjs)
```

Documentación técnica adicional en [`docs/`](docs/overview.md) (arquitectura, modelo de datos, referencia IPC, seguridad).

## Documentos clave

- [LICENCIAS.md](LICENCIAS.md) — cómo emitir y gestionar licencias (guía del vendedor).
- [FISCAL.md](FISCAL.md) — configuración fiscal dominicana: NCF, ITBIS y reporte 607.
- [MANUAL.md](MANUAL.md) — manual del usuario final (se entrega al cliente).

## Regla de oro del esquema

Los cambios de esquema de base de datos van **SIEMPRE** en una migración nueva en `src/main/migrations` — **nunca** reactivar `synchronize` en TypeORM. Las bases de datos de los clientes en producción solo se actualizan por migraciones.
