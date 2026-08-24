import { useState, useEffect } from 'react';
import { Button } from "@components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@components/ui/table"
import { useUser } from "@renderer/features/auth"
import { Users } from 'lucide-react';
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    async function loadUsers() {
      try {
        const result = await ipc.invoke('get-users') as UsersResponse;
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
      }
    }

    loadUsers();
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

  return (
    <>
      <div className="bg-card border border-border rounded-lg p-6">
        <WidgetHeader
          icon={Users}
          title="Gestión de Usuarios"
          subtitle="Administra los usuarios del sistema"
          action={role === 'admin' && (
            <Button size="sm" onClick={() => { setSelectedUser(null); setIsDialogOpen(true); }}>Agregar Usuario</Button>
          )}
        />
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableHead className="text-xs text-muted-foreground font-medium">Nombre</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium">Username</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium">Rol</TableHead>
                {role === 'admin' && <TableHead className="text-xs text-muted-foreground font-medium text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border [&_tr]:border-0">
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-muted-foreground">{user.username}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs font-medium text-foreground whitespace-nowrap">
                      {(user as ExtendedUser).role_entity?.name || user.role}
                    </span>
                  </TableCell>
                  {role === 'admin' && (
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={() => { setSelectedUser(user); setIsDialogOpen(true); }}>
                        Editar
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { setSelectedUser(user); setIsAlertOpen(true); }}>
                        Eliminar
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente al usuario.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
