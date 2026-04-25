# Operacion y despliegue

## Ubicaciones importantes

| Recurso | Ubicacion |
| --- | --- |
| Base SQLite | `app.getPath('userData')/database.sqlite` |
| Backups | `app.getPath('userData')/backups` |
| Logos subidos | `app.getPath('userData')/logo_*.ext` |
| PDFs de reportes | Carpeta Downloads del usuario |
| Build renderer | `dist/` |
| Build Electron | `dist-electron/` |
| Instaladores | `release/` |

## Empaquetado

La configuracion de electron-builder vive en `package.json`.

| Campo | Valor |
| --- | --- |
| `appId` | `com.venilu.pos` |
| `productName` | `Venilu` |
| Windows target | `nsis` |
| Linux target | `deb` |
| Build resources | `public/assets` |
| Publish provider | GitHub |

## Auto-update

`electron-updater` se configura en `src/main/shared/ipc/updater.ipc.ts`.

Comportamiento:

- `autoDownload = true`
- `autoInstallOnAppQuit = true`
- En produccion revisa updates 3 segundos despues de crear la ventana.
- En desarrollo no ejecuta `checkForUpdates`.

## Backups

El servicio usa SQLite `VACUUM INTO ?` para crear backups consistentes.

Flujo de restauracion:

1. Valida que el backup exista.
2. Cierra `AppDataSource`.
3. Copia la base actual como backup pre-restore.
4. Reemplaza `database.sqlite`.
5. Elimina archivos `-wal` y `-shm` si existen.
6. Reinicializa TypeORM.

Riesgo operativo: restaurar mientras la UI sigue interactuando con datos puede causar estados de pantalla obsoletos. Se recomienda reiniciar la app luego de restaurar.

## Impresion

La impresion crea una ventana oculta, carga HTML de recibo mediante data URL y llama `webContents.print`.

El recibo toma:

- Datos de venta.
- Items de venta.
- Usuario vendedor.
- Settings del negocio.
- Logo si existe.
- Impresora configurada o impresora default.

## Reportes PDF

El PDF se genera con `printToPDF` sobre una ventana oculta y se escribe en Downloads.

Nombre actual:

```text
Reporte_Ventas_<inicio>_a_<fin>.pdf
```

## Recomendaciones de produccion

- Reemplazar `synchronize: true` por migraciones TypeORM.
- Proteger todos los handlers sensibles con `requireAuth` o `requireRole`.
- Registrar logs persistentes para errores de DB, impresion, backup y updater.
- Versionar cambios de schema.
- Probar restore de backup en entorno aislado antes de entregarlo a usuarios.
- Validar permisos de escritura en `userData` y Downloads.

