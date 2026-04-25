# Modulo: reportes

## Responsabilidad

Calcula metricas financieras, productos mas/menos vendidos, ventas por periodo, dashboard stats y PDF.

## Archivos principales

| Archivo | Rol |
| --- | --- |
| `src/main/modules/reports/services/reports.service.ts` | Queries y metricas |
| `src/main/modules/reports/reports.ipc.ts` | IPC admin-only |
| `src/main/shared/services/pdf.service.ts` | Export PDF |
| `src/renderer/features/reports/hooks/use-reports.ts` | Estado de reportes |
| `src/renderer/pages/dashboard/hooks/use-dashboard.ts` | Dashboard |

## Metricas

- Total ventas.
- Ganancia neta.
- Costo total.
- Margen promedio.
- Conteo de ventas.
- Items vendidos.
- Ticket promedio.

## IPC

- `get-total-sales-metrics`
- `get-top-selling-products`
- `get-sales-over-time`
- `get-least-selling-products`
- `get-dashboard-stats`
- `generate-sales-report-pdf`

## Nota de consistencia

El renderer invoca `clear-reports-cache`, pero no existe handler en main. Se debe eliminar la llamada o implementar el handler.

