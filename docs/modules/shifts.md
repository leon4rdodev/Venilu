# Modulo: turnos

## Responsabilidad

Gestiona apertura, cierre, caja esperada, diferencia, historial y cierre forzado de turnos.

## Archivos principales

| Archivo | Rol |
| --- | --- |
| `src/main/modules/shifts/entities/shift.entity.ts` | Entidad `Shift` |
| `src/main/modules/shifts/services/shifts.service.ts` | Reglas de turno |
| `src/main/modules/shifts/shifts.ipc.ts` | IPC |
| `src/renderer/features/pos/hooks/use-shift.tsx` | Contexto de turno |
| `src/renderer/features/pos/components/open-shift-dialog.tsx` | Apertura |
| `src/renderer/features/pos/components/close-shift-dialog.tsx` | Cierre |

## Reglas

- Un usuario no puede tener mas de un turno abierto.
- El ID de turno es corto y generado aleatoriamente.
- Solo turnos abiertos pueden cerrarse.
- Caja esperada:

```text
initial_cash + ventas_en_efectivo + abonos_de_deuda_en_efectivo
```

- Diferencia:

```text
final_cash - expected_cash
```

- Admin puede cerrar forzadamente cualquier turno abierto.

## IPC

- `shifts:getActive`
- `shifts:open`
- `shifts:close`
- `shifts:getSales`
- `history:get`
- `shifts:getDebtPayments`
- `shifts:forceClose`

