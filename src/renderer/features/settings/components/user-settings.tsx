import { useState, useEffect } from 'react';
import { Button, buttonVariants } from "@components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@components/ui/table"
import { Skeleton } from "@components/ui/skeleton"
import { useUser } from "@renderer/features/auth"
import { Plus, Users } from 'lucide-react';
import { WidgetHeader } from "@renderer/shared/components/widget-header"
import { UserDialog } from './user-dialog';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@components/ui/alert-dialog';
import { ipc } from '@lib/ipc';
import { User, Role } from '@shared/types/models';

// Extended type since role_entity comes from the eager relation in the backend
interface ExtendedUser extends User {
  role_entity?: Role;
}

interface UsersResponse {
  success: boolean;
  data?: User[];
}

export function UserSettings() {
  const { user } = useUser();
  const role = user?.role;
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadUsers() {
      try {
        const result = await ipc.invoke('get-users') as UsersResponse;
        if (cancelled) return;
        if (result.success && result.data) {
          const mappedUsers = result.data.map((u: ExtendedUser) => ({
            ...u,
            created_at: u.created_at || new Date(),
            updated_at: u.updated_at || new Date()
          })) as User[];
          setUsers(mappedUsers);
        }
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadUsers();
    return () => { cancelled = true; };
  }, [refreshTrigger]);

  const handleSave = () => {
    setIsDialogOpen(false);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleDelete = async () => {
    if (selectedUser) {
      await ipc.invoke('delete-user', selectedUser.id);
      setIsAlertOpen(false);
      setRefreshTrigger(prev => prev + 1);
    }
  };

  const isAdmin = role === 'admin';
  const columnCount = isAdmin ? 4 : 3;

  return (
    <>
      <div className="bg-card border border-border rounded-lg p-6">
        <WidgetHeader
          icon={Users}
          title="Gestión de Usuarios"
          subtitle="Administra los usuarios del sistema"
          action={isAdmin && (
            <Button size="sm" onClick={() => { setSelectedUser(null); setIsDialogOpen(true); }}>
              <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Agregar Usuario
            </Button>
          )}
        />
        <div className="mt-4 rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border hover:bg-transparent">
                  <TableHead className="text-xs text-muted-foreground font-medium">Nombre</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-medium">Usuario</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-medium">Rol</TableHead>
                  {isAdmin && (
                    <TableHead className="text-xs text-muted-foreground font-medium text-right">Acciones</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border [&_tr]:border-0">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i} className="hover:bg-transparent">
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                      {isAdmin && <TableCell><Skeleton className="ml-auto h-8 w-32" /></TableCell>}
                    </TableRow>
                  ))
                ) : users.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={columnCount}>
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                          <Users className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.5} aria-hidden="true" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">No hay usuarios registrados</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Agrega usuarios para que puedan iniciar sesión en el sistema.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => {
                    const isSelf = u.id === user?.id;
                    return (
                      <TableRow key={u.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="font-medium">
                          <span className="inline-flex items-center gap-2">
                            {u.name}
                            {isSelf && (
                              <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                                Tú
                              </span>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-sm">{u.username}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs font-medium text-foreground whitespace-nowrap">
                            {(u as ExtendedUser).role_entity?.name || u.role}
                          </span>
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-foreground"
                                aria-label={`Editar a ${u.name}`}
                                onClick={() => { setSelectedUser(u); setIsDialogOpen(true); }}
                              >
                                Editar
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                aria-label={`Eliminar a ${u.name}`}
                                onClick={() => { setSelectedUser(u); setIsAlertOpen(true); }}
                              >
                                Eliminar
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <UserDialog
        user={selectedUser}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSave}
      />

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente al usuario
              {selectedUser ? (
                <>
                  {' '}
                  <span className="font-medium text-foreground">{selectedUser.name}</span>
                  {' '}
                  <span className="font-mono">({selectedUser.username})</span>
                </>
              ) : null}
              {' '}y ya no podrá iniciar sesión.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className={buttonVariants({ variant: 'destructive' })}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
