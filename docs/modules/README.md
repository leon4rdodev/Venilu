# Guia de modulos

Esta carpeta documenta cada modulo funcional de Venilu.

## Modulos

| Modulo | Documento | Responsabilidad |
| --- | --- | --- |
| Auth y usuarios | [users.md](users.md) | Login, roles, onboarding admin |
| Productos | [products.md](products.md) | Inventario y productos |
| Categorias | [categories.md](categories.md) | Clasificacion de productos |
| Ventas | [sales.md](sales.md) | Procesamiento de ventas y deuda |
| Turnos | [shifts.md](shifts.md) | Caja, apertura, cierre, historial |
| Clientes | [customers.md](customers.md) | Clientes, credito y balance |
| Reportes | [reports.md](reports.md) | Metricas, graficas y PDF |
| Settings | [settings.md](settings.md) | Negocio, moneda, impresora, logo |
| Backups | [backups.md](backups.md) | Copias y restauracion SQLite |
| Printer | [printer.md](printer.md) | Recibos e impresoras |
| Layout/UI | [layout-ui.md](layout-ui.md) | Shell visual, navegacion y componentes |

## Patron comun

La mayoria de modulos del proceso main siguen esta estructura:

```text
src/main/modules/<module>/
  entities/        Entidades TypeORM
  services/        Reglas de negocio
  <module>.ipc.ts  Handlers IPC
```

La mayoria de modulos del renderer siguen:

```text
src/renderer/features/<feature>/
  components/      Componentes de UI del dominio
  hooks/           Estado y llamadas IPC
  index.ts         Barrel export
```

