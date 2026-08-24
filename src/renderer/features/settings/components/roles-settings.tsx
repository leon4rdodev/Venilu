import { useState, useEffect } from 'react';
import { Button } from "@components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@components/ui/table"
import { useUser } from "@renderer/features/auth"
import { WidgetHeader } from "@renderer/shared/components/widget-header"
import { RoleDialog } from './role-dialog';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@components/ui/alert-dialog';
import { ipc } from '@lib/ipc';
import { Role } from '@shared/types/models';
import { Shield, ShieldCheck, Settings, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface RolesResponse {
  success: boolean;
  data?: Role[];
}

export function RolesSettings() {
  const { user } = useUser();
  // Only system admins should really manage roles, we check role === 'admin'
  // or maybe better, permissions, but role === 'admin' is safe here since this is the settings UI
  const isAdmin = user?.role === 'admin';
  const [roles, setRoles] = useState<Role[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    async function loadRoles() {
      try {
        const result = await ipc.invoke('roles:list') as RolesResponse;
        if (result.success && result.data) {
          setRoles(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch roles:', error);
        toast.error('Error al cargar roles');
      }
    }

    loadRoles();
  }, [refreshTrigger]);

  const handleSave = () => {
    setIsDialogOpen(false);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleDelete = async () => {
    if (selectedRole) {
      if (selectedRole.is_system) {
        toast.error('No se pueden eliminar roles del sistema');
        setIsAlertOpen(false);
        return;
      }
      try {
        const result = await ipc.invoke('roles:delete', selectedRole.id) as { success: boolean; message?: string };
        if (result.success) {
          toast.success('Rol eliminado');
          setRefreshTrigger(prev => prev + 1);
        } else {
          toast.error(result.message || 'Error al eliminar rol');
        }
      } catch (error) {
        console.error('Error deleting role:', error);
        toast.error('Error de conexión');
      } finally {
        setIsAlertOpen(false);
      }
    }
  };

  return (
    <>
      <div className="bg-card border border-border rounded-lg p-6">
        <WidgetHeader
          icon={ShieldCheck}
          title="Roles y Permisos"
          subtitle="Configura roles personalizados y asigna permisos específicos"
          action={isAdmin && (
            <Button size="sm" onClick={() => { setSelectedRole(null); setIsDialogOpen(true); }}>
              Crear Nuevo Rol
            </Button>
          )}
        />
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border hover:bg-transparent">
                <TableHead className="text-xs text-muted-foreground font-medium">Nombre del Rol</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium">Nivel de Acceso</TableHead>
                <TableHead className="text-xs text-muted-foreground font-medium">Permisos</TableHead>
                {isAdmin && <TableHead className="text-xs text-muted-foreground font-medium text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border [&_tr]:border-0">
              {roles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="font-medium flex items-center gap-2">
                    {role.is_system ? <Shield className="h-4 w-4 text-foreground" strokeWidth={1.75} /> : <Settings className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />}
                    {role.name}
                  </TableCell>
                  <TableCell>
                    {role.is_system ? (
                      <span className="inline-flex items-center rounded-full bg-foreground px-2 py-1 text-xs font-medium text-background whitespace-nowrap">Sistema</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs font-medium text-foreground whitespace-nowrap">Personalizado</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground text-sm">{role.permissions.length} permisos</span>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      {role.is_system && role.name === 'Administrador' ? (
                        <div className="flex items-center justify-end gap-1">
                           <Button variant="ghost" size="sm" disabled title="El rol Administrador no se puede modificar" className="opacity-50">
                            Editar
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" onClick={() => { setSelectedRole(role); setIsDialogOpen(true); }}>
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => { setSelectedRole(role); setIsAlertOpen(true); }}
                            disabled={role.is_system}
                            title={role.is_system ? "Los roles del sistema no se pueden eliminar" : ""}
                          >
                            Eliminar
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {roles.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 4 : 3} className="text-center py-6 text-muted-foreground">
                    Cargando roles...
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <RoleDialog
        role={selectedRole}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSave}
      />

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" strokeWidth={1.75} />
              ¿Eliminar rol personalizado?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Los usuarios que tengan este rol podrían perder el acceso al sistema hasta que se les asigne un rol nuevo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              Eliminar Rol
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
