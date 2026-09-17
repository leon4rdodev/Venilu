import { useState, useEffect } from 'react';
import { Button, buttonVariants } from "@components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@components/ui/table"
import { Skeleton } from "@components/ui/skeleton"
import { useUser } from "@renderer/features/auth"
import { WidgetHeader } from "@renderer/shared/components/widget-header"
import { RoleDialog } from './role-dialog';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@components/ui/alert-dialog';
import { ipc } from '@lib/ipc';
import { Role } from '@shared/types/models';
import { Shield, ShieldCheck, Settings, AlertCircle, Plus, Lock } from 'lucide-react';
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
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadRoles() {
      try {
        const result = await ipc.invoke('roles:list') as RolesResponse;
        if (cancelled) return;
        if (result.success && result.data) {
          setRoles(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch roles:', error);
        toast.error('Error al cargar roles');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadRoles();
    return () => { cancelled = true; };
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

  const columnCount = isAdmin ? 4 : 3;

  return (
    <>
      <div className="bg-card border border-border rounded-lg p-6">
        <WidgetHeader
          icon={ShieldCheck}
          title="Roles y Permisos"
          subtitle="Configura roles personalizados y asigna permisos específicos"
          action={isAdmin && (
            <Button size="sm" onClick={() => { setSelectedRole(null); setIsDialogOpen(true); }}>
              <Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
              Crear Nuevo Rol
            </Button>
          )}
        />
        <div className="mt-4 rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-border hover:bg-transparent">
                  <TableHead className="text-xs text-muted-foreground font-medium">Nombre del Rol</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-medium">Nivel de Acceso</TableHead>
                  <TableHead className="text-xs text-muted-foreground font-medium text-right">Permisos</TableHead>
                  {isAdmin && <TableHead className="text-xs text-muted-foreground font-medium text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border [&_tr]:border-0">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i} className="hover:bg-transparent">
                      <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="ml-auto h-4 w-20" /></TableCell>
                      {isAdmin && <TableCell><Skeleton className="ml-auto h-8 w-32" /></TableCell>}
                    </TableRow>
                  ))
                ) : roles.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={columnCount}>
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                          <ShieldCheck className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.5} aria-hidden="true" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">No hay roles definidos</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Crea un rol para asignar permisos específicos a tus usuarios.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  roles.map((role) => {
                    const isProtected = role.is_system && role.name === 'Administrador';
                    return (
                      <TableRow key={role.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {role.is_system
                              ? <Shield className="h-4 w-4 shrink-0 text-foreground" strokeWidth={1.75} aria-hidden="true" />
                              : <Settings className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />}
                            <span className="truncate">{role.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {role.is_system ? (
                            <span className="inline-flex items-center rounded-full bg-foreground px-2 py-1 text-xs font-medium text-background whitespace-nowrap">Sistema</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs font-medium text-foreground whitespace-nowrap">Personalizado</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-muted-foreground text-sm tabular-nums">
                            {role.permissions.length} {role.permissions.length === 1 ? 'permiso' : 'permisos'}
                          </span>
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            {isProtected ? (
                              <span
                                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground pr-3"
                                title="El rol Administrador tiene todos los permisos y no se puede modificar"
                              >
                                <Lock className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
                                Protegido
                              </span>
                            ) : (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-muted-foreground hover:text-foreground"
                                  aria-label={`Editar rol ${role.name}`}
                                  onClick={() => { setSelectedRole(role); setIsDialogOpen(true); }}
                                >
                                  Editar
                                </Button>
                                {!role.is_system && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    aria-label={`Eliminar rol ${role.name}`}
                                    onClick={() => { setSelectedRole(role); setIsAlertOpen(true); }}
                                  >
                                    Eliminar
                                  </Button>
                                )}
                              </div>
                            )}
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
        <p className="mt-3 text-xs text-muted-foreground">
          Los roles del sistema no se pueden eliminar; el rol Administrador tampoco se puede modificar.
        </p>
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
              <AlertCircle className="h-5 w-5 text-destructive" strokeWidth={1.75} aria-hidden="true" />
              ¿Eliminar rol personalizado?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Los usuarios que tengan el rol
              {selectedRole ? <> <span className="font-medium text-foreground">{selectedRole.name}</span></> : ' seleccionado'}
              {' '}podrían perder el acceso al sistema hasta que se les asigne un rol nuevo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className={buttonVariants({ variant: 'destructive' })}>
              Eliminar Rol
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
