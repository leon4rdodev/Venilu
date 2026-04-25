# Arquitectura

## Resumen

Venilu usa una arquitectura Electron de dos procesos:

- **Main process**: acceso a sistema operativo, base de datos, impresoras, backups, PDF, actualizaciones y reglas de negocio.
- **Renderer process**: interfaz React, routing, estado de UI, formularios, tablas, graficas y llamadas IPC.

La comunicacion entre ambos ocurre mediante `ipcMain.handle` en main y `ipcRenderer.invoke` expuesto por `contextBridge` en preload.

## Diagrama logico

```text
Usuario
  |
  v
Renderer React
  |  window.ipcRenderer.invoke(...)
  v
Preload contextBridge
  |
  v
Electron main IPC handlers
  |
  v
Servicios de dominio
  |
  v
TypeORM repositories
  |
  v
SQLite database.sqlite
```

## Capas

| Capa | Ruta | Responsabilidad |
| --- | --- | --- |
| App shell | `src/main/main.ts` | Crear ventana, iniciar DB, registrar IPC |
| Preload | `src/preload.ts` | Exponer API IPC limitada al renderer |
| Data source | `src/main/config/data-source.ts` | Configurar SQLite y entidades |
| Entidades | `src/main/modules/**/entities` | Modelo persistente TypeORM |
| Servicios | `src/main/modules/**/services` | Reglas de negocio y transacciones |
| IPC | `src/main/modules/**/*.ipc.ts` | Contratos renderer-main |
| UI features | `src/renderer/features` | Componentes y hooks por dominio |
| Paginas | `src/renderer/pages` | Vistas routeables |
| Tipos compartidos | `src/shared/types` | Interfaces de dominio e IPC |

## Inicializacion

1. `app.whenReady()` ejecuta `initialize`.
2. `AppDataSource.initialize()` abre SQLite.
3. Se registran handlers de sesion, usuarios, productos, categorias, ventas, turnos, settings, reportes, backups, clientes y printer.
4. Se crea `BrowserWindow`.
5. En desarrollo se carga `http://localhost:5173`.
6. En produccion se carga `dist/index.html`.
7. Se configura `electron-updater`.

## Base de datos

La base se guarda en:

```text
app.getPath('userData')/database.sqlite
```

El proyecto usa `synchronize: true` en TypeORM. Esto simplifica el MVP, pero para produccion madura conviene migrar a migraciones versionadas.

## Routing

El renderer usa `HashRouter`, apropiado para apps Electron empaquetadas. Rutas principales:

| Ruta | Pagina |
| --- | --- |
| `/onboarding` | Configuracion inicial |
| `/login` | Inicio de sesion |
| `/dashboard` | Resumen operacional |
| `/pos` | Punto de venta |
| `/inventory` | Inventario |
| `/customers` | Clientes |
| `/reports` | Reportes |
| `/settings` | Ajustes |

## Estado global relevante

| Contexto | Archivo | Responsabilidad |
| --- | --- | --- |
| Usuario | `features/auth/hooks/use-user.tsx` | Usuario actual y restauracion de sesion |
| Turno | `features/pos/hooks/use-shift.tsx` | Turno activo, ventas y pagos de deuda del turno |
| Moneda | `shared/context/currency-context.tsx` | Formato monetario |
| Tema | `shared/hooks/use-theme.tsx` | Light/dark mode |

