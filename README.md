# Venilu

Venilu es una aplicacion POS de escritorio construida con Electron, React, TypeScript, SQLite y TypeORM. El sistema esta orientado a venta en mostrador, gestion de inventario, turnos de caja, clientes con credito, reportes, backups, configuracion del negocio e impresion de recibos.

## Indice rapido

- [Vision general](docs/overview.md)
- [Arquitectura](docs/architecture.md)
- [Instalacion y desarrollo](docs/setup.md)
- [Modelo de datos](docs/data-model.md)
- [Referencia IPC](docs/ipc-reference.md)
- [Operacion y despliegue](docs/operations.md)
- [Seguridad y permisos](docs/security.md)
- [Guia de modulos](docs/modules/README.md)

## Stack tecnico

| Capa | Tecnologia |
| --- | --- |
| Desktop runtime | Electron |
| Frontend | React 19, React Router, Vite, Tailwind CSS |
| UI | Radix UI, shadcn-style components, lucide-react, framer-motion |
| Backend local | Electron main process, IPC |
| Persistencia | SQLite, TypeORM |
| Autenticacion local | bcryptjs, sesion en main process |
| Reportes | Recharts, PDF via Electron printToPDF |
| Impresion | Electron `webContents.print` |
| Build | TypeScript, Vite, electron-builder |

## Comandos principales

```bash
npm install
npm run dev
npm run build
npm run build:win
npm run build:linux
npm run seed
```

En PowerShell, si `npm run ...` falla por politica de ejecucion de scripts, usar `npm.cmd run ...`.

## Estructura principal

```text
src/
  main/        Proceso main de Electron, TypeORM, servicios e IPC
  renderer/    Aplicacion React, paginas, features, componentes y hooks
  shared/      Tipos compartidos entre main y renderer
  preload.ts   Puente seguro hacia IPC con contextBridge
docs/          Documentacion tecnica del proyecto
```

## Estado de verificacion

La documentacion fue escrita a partir del codigo actual. Durante la revision se detecto que `npm.cmd run lint` no ejecuta correctamente porque `package.json` declara `"type": "commonjs"` y `eslint.config.js` usa sintaxis ESM. Ver [setup](docs/setup.md#lint-y-calidad) para el detalle.

