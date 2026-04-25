# Modulo: settings

## Responsabilidad

Guarda configuracion general del negocio, impresora, papel, moneda y logo.

## Archivos principales

| Archivo | Rol |
| --- | --- |
| `src/main/modules/settings/entities/setting.entity.ts` | Entidad `Setting` |
| `src/main/modules/settings/services/settings.service.ts` | Get/update |
| `src/main/modules/settings/settings.ipc.ts` | IPC settings y logo |
| `src/renderer/features/settings/hooks/use-settings.ts` | Estado de settings |
| `src/renderer/features/settings/hooks/use-logo-upload.ts` | Logo |
| `src/renderer/features/settings/components/settings-interface.tsx` | UI |

## Campos

- `business_name`
- `business_address`
- `business_phone`
- `business_email`
- `business_tax_id`
- `logo_filename`
- `printer_name`
- `paper_size`
- `currency`

## IPC

- `settings:get`
- `settings:update`
- `upload-logo`
- `get-logo`
- `delete-logo`

## Reglas

- `settings:get` requiere autenticacion.
- `settings:update` requiere admin, excepto durante onboarding.
- Si no existe fila `id = 1`, se crea configuracion default.

## Riesgo a corregir

Los handlers de logo no validan autenticacion/rol actualmente.

