# Instalacion y desarrollo

## Requisitos

- Node.js compatible con Electron 39 y Vite 7.
- npm.
- Windows, Linux o entorno soportado por Electron.
- Dependencias nativas disponibles para `sqlite3`.

## Instalacion

```bash
npm install
```

El script `postinstall` ejecuta:

```bash
electron-builder install-app-deps
```

Esto prepara dependencias nativas para Electron.

## Desarrollo

```bash
npm run dev
```

El comando compila TypeScript para Electron y ejecuta en paralelo:

- Vite dev server.
- Electron en modo desarrollo.

## Build

```bash
npm run build
```

Flujo del build:

1. `vite build` genera `dist`.
2. `tsc -p tsconfig.electron.json` genera `dist-electron`.
3. `tsc-alias` resuelve aliases.
4. `electron-builder` empaqueta la app.

Builds por plataforma:

```bash
npm run build:win
npm run build:linux
```

## Seed

```bash
npm run seed
```

Ejecuta `src/main/seed.ts` usando `ts-node`, `tsconfig-paths` y `tsconfig.electron.json`.

## Lint y calidad

Comando esperado:

```bash
npm run lint
```

En PowerShell puede fallar por politica de ejecucion de scripts. Usar:

```bash
npm.cmd run lint
```

Estado actual detectado: ESLint falla porque el paquete declara `"type": "commonjs"` y `eslint.config.js` usa `import`. Opciones recomendadas:

1. Renombrar `eslint.config.js` a `eslint.config.mjs`.
2. Cambiar la config a CommonJS.
3. Cambiar `"type"` a `"module"` solo si se revisa impacto en Electron main, build y scripts.

## Variables de entorno

Existe `.env.example`. Revisar ese archivo antes de introducir nuevas variables. La app actual se comporta principalmente como local-first y no depende de servicios remotos para operar.

## Archivos generados

| Ruta | Descripcion |
| --- | --- |
| `node_modules/` | Dependencias |
| `dist/` | Build del renderer |
| `dist-electron/` | Build del proceso main/preload |
| `release/` | Salida de electron-builder |
| `app.getPath('userData')/database.sqlite` | Base SQLite de ejecucion |

