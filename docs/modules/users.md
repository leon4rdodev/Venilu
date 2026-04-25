# Modulo: usuarios y autenticacion

## Responsabilidad

Gestiona usuarios locales, roles, login y estado de onboarding.

## Archivos principales

| Archivo | Rol |
| --- | --- |
| `src/main/modules/users/entities/user.entity.ts` | Entidad `User` |
| `src/main/modules/users/services/users.service.ts` | Hash, CRUD, login, onboarding |
| `src/main/modules/users/users.ipc.ts` | Handlers IPC |
| `src/main/shared/session.ts` | Sesion main process |
| `src/renderer/features/auth/hooks/use-user.tsx` | Estado de usuario en renderer |
| `src/renderer/pages/login/page.tsx` | UI de login |
| `src/renderer/pages/onboarding/page.tsx` | UI de onboarding |

## Reglas

- `username` es unico.
- Passwords se guardan con bcrypt.
- El onboarding se considera completo cuando existe al menos un usuario admin.
- `create-user` permite crear el primer usuario sin sesion admin.
- Luego del onboarding, crear/editar/eliminar usuarios requiere admin.

## IPC

- `login-request`
- `get-users`
- `create-user`
- `update-user`
- `delete-user`
- `onboarding:check`
- `set-logged-in-user`
- `logout`

## Riesgo a corregir

La sesion main se puede restaurar desde datos enviados por renderer. Recomendado: `login-request` debe setear la sesion al validar credenciales y la restauracion debe consultar la DB.

