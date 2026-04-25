# Seguridad y permisos

## Modelo actual

Venilu usa autenticacion local:

- Passwords con hash bcrypt.
- Roles `admin` y `employee`.
- Sesion en memoria dentro del proceso main.
- Algunas rutas del renderer se ocultan segun rol.
- Algunos handlers IPC validan `requireAuth` o `requireRole`.

## Permisos por rol

| Area | Admin | Employee |
| --- | --- | --- |
| Dashboard | Si | Parcial segun UI |
| POS | Si | Si |
| Clientes | Si | Si |
| Inventario | Si | No en sidebar |
| Reportes | Si | No |
| Settings | Si | No |
| Usuarios | Si | No |
| Cierre forzado de turno | Si | No |

## Puntos fuertes

- `nodeIntegration` esta desactivado.
- `contextIsolation` esta activado.
- IPC se expone mediante `contextBridge`.
- Passwords no se devuelven al renderer en login.
- Reportes y usuarios estan protegidos por rol admin.
- Productos y categorias diferencian lectura autenticada y escritura admin.

## Riesgos detectados

| Riesgo | Impacto | Recomendacion |
| --- | --- | --- |
| `set-logged-in-user` confia en payload del renderer | Un renderer comprometido podria fijar rol admin | Setear sesion en `login-request` y restaurar validando DB |
| `process-sale` sin `requireAuth` | Venta invocable sin sesion main | Agregar `requireAuth` |
| `get-sales`, `get-recent-sales`, `get-sale-items` sin `requireAuth` | Lectura de ventas sin sesion | Agregar `requireAuth` |
| Backups sin proteccion IPC | Crear/restaurar/eliminar DB sin rol | Requerir admin |
| Logo handlers sin proteccion | Escritura/borrado en `userData` | Requerir admin u onboarding |
| `updater:install-now` sin proteccion | Reinicio de app desde renderer | Requerir admin o canal UI controlado |
| `synchronize: true` | Cambios automaticos de schema en produccion | Migraciones versionadas |

## Checklist recomendado

- [ ] Mover seteo real de sesion al handler `login-request`.
- [ ] Validar usuario restaurado desde localStorage contra DB antes de aceptar sesion.
- [ ] Aplicar `requireAuth` a ventas y printer.
- [ ] Aplicar `requireRole('admin')` a backups, restore, delete y updater install.
- [ ] Aplicar validacion de path/nombre a archivos de logo y backup.
- [ ] Registrar auditoria para backup restore y cierre forzado.
- [ ] Evitar exponer `send/on/off` genericos si no son necesarios.

