# Modulo: printer

## Responsabilidad

Detecta impresoras, genera HTML de recibo e imprime tickets.

## Archivos principales

| Archivo | Rol |
| --- | --- |
| `src/main/shared/services/printer.service.ts` | Generacion HTML e impresion |
| `src/main/shared/ipc/printer.ipc.ts` | IPC |
| `src/renderer/features/pos/components/payment-dialog.tsx` | Impresion post-venta |
| `src/renderer/features/pos/components/sale-confirmation-dialog.tsx` | Confirmacion |
| `src/renderer/features/settings/components/printer-settings.tsx` | Configuracion |

## Flujo

1. Se busca la venta por ID.
2. Se cargan items, usuario y settings.
3. Se genera HTML adaptado a papel `80mm` o `58mm`.
4. Se carga logo desde `userData` si existe.
5. Se usa impresora configurada o default.
6. Se imprime con `webContents.print`.

## IPC

- `get-printers`
- `print-receipt`
- `test-print`

## Recomendaciones

- Proteger `print-receipt` con `requireAuth`.
- Implementar prueba real en `test-print`.
- Escapar contenido dinamico del recibo si se permite texto libre.

