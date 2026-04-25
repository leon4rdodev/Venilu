# Modulo: backups

## Responsabilidad

Crea, lista, restaura y elimina copias de la base SQLite.

## Archivos principales

| Archivo | Rol |
| --- | --- |
| `src/main/modules/backups/services/backups.service.ts` | Logica de archivos y SQLite |
| `src/main/modules/backups/backups.ipc.ts` | IPC |
| `src/renderer/features/settings/components/backup-settings.tsx` | UI |

## Flujo crear backup

1. Asegura carpeta `userData/backups`.
2. Genera nombre `backup_<type>_<timestamp>.sqlite`.
3. Ejecuta `VACUUM INTO ?`.
4. Devuelve metadata del archivo.

## Flujo restaurar backup

1. Valida existencia.
2. Cierra `AppDataSource`.
3. Crea backup pre-restore.
4. Copia el backup sobre `database.sqlite`.
5. Elimina WAL/SHM.
6. Reinicia `AppDataSource`.

## IPC

- `backup:create`
- `backup:list`
- `backup:restore`
- `backup:delete`

## Inconsistencia actual

La UI invoca `backup:export`, pero no existe handler registrado.

## Riesgo a corregir

Los handlers de backup no requieren admin actualmente. Restaurar o eliminar backups debe ser operacion admin-only.

