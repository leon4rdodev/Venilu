import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card"
import { Button } from "@components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@components/ui/table"
import { Badge } from "@components/ui/badge"
import { useUser } from "@renderer/features/auth"
import { UserDialog } from './user-dialog';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@components/ui/alert-dialog';
import { ipc } from '@lib/ipc';
import { User } from '@shared/types/models';

// Using shared User model from @shared/types/models

interface UsersResponse {
  success: boolean;
  users: User[];
}

export function UserSettings() {
  const { user } = useUser();
  const role = user?.role;
  const [users, setUsers] = useState<User[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const fetchUsers = useCallback(async () => {
    const result = await ipc.invoke('get-users') as UsersResponse;
    if (result.success) {
      const mappedUsers = result.users.map((u: any) => ({
        ...u,
        created_at: u.created_at || new Date(),
        updated_at: u.updated_at || new Date()
      }));
      setUsers(mappedUsers);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSave = () => {
    setIsDialogOpen(false);
    fetchUsers();
  };

  const handleDelete = async () => {
    if (selectedUser) {
      await ipc.invoke('delete-user', selectedUser.id);
      setIsAlertOpen(false);
      fetchUsers();
    }
  };

  return (
    <>
      <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Gestión de Usuarios</CardTitle>
            <CardDescription className="text-xs">Administra los usuarios del sistema</CardDescription>
          </div>
          {role === 'admin' && <Button size="sm" onClick={() => { setSelectedUser(null); setIsDialogOpen(true); }}>Agregar Usuario</Button>}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Rol</TableHead>
                {role === 'admin' && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{user.role}</Badge>
                  </TableCell>
                  {role === 'admin' && (
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedUser(user); setIsDialogOpen(true); }}>
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
        </CardContent>
      </Card>

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
