import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@components/ui/dialog';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Switch } from '@components/ui/switch';
import { Plus, Check, ShieldCheck, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Role } from '@shared/types/models';
import { PERMISSIONS, Permission } from '@shared/permissions';
import { ipc } from '@lib/ipc';

interface RoleDialogProps {
  role: Role | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

// Group permissions logically for the UI
const PERMISSION_GROUPS = [
  {
    title: 'Punto de Venta (POS)',
    permissions: [
      { id: PERMISSIONS.POS_ACCESS, label: 'Acceder al POS' },
      { id: PERMISSIONS.POS_OPEN_SHIFT, label: 'Abrir turnos de caja' },
      { id: PERMISSIONS.POS_CLOSE_SHIFT, label: 'Cerrar turnos de caja' },
      { id: PERMISSIONS.POS_DISCOUNT, label: 'Aplicar descuentos' },
      { id: PERMISSIONS.POS_PRICE_OVERRIDE, label: 'Sobrescribir precios en el carrito' },
      { id: PERMISSIONS.POS_CREDIT_SALE, label: 'Hacer ventas a crédito' },
    ]
  },
  {
    title: 'Inventario y Productos',
    permissions: [
      { id: PERMISSIONS.INV_VIEW, label: 'Ver inventario (Precios, stock)' },
      { id: PERMISSIONS.INV_VIEW_COSTS, label: 'Ver precios de costo (Confidencial)' },
      { id: PERMISSIONS.INV_CREATE, label: 'Crear productos' },
      { id: PERMISSIONS.INV_EDIT, label: 'Editar info. básica de productos' },
      { id: PERMISSIONS.INV_EDIT_PRICE, label: 'Modificar precios de venta' },
      { id: PERMISSIONS.INV_ADJUST_STOCK, label: 'Ajustar stock manualmente' },
      { id: PERMISSIONS.INV_DELETE, label: 'Eliminar productos' },
      { id: PERMISSIONS.INV_CATEGORIES, label: 'Gestionar categorías' },
      { id: PERMISSIONS.INV_STOCK_ALERTS, label: 'Configurar alertas de stock bajo' },
    ]
  },
  {
    title: 'Clientes',
    permissions: [
      { id: PERMISSIONS.CUST_VIEW, label: 'Ver lista de clientes' },
      { id: PERMISSIONS.CUST_VIEW_BALANCE, label: 'Ver saldos y deudas' },
      { id: PERMISSIONS.CUST_CREATE, label: 'Crear y editar clientes' },
      { id: PERMISSIONS.CUST_PAY_DEBT, label: 'Registrar pagos de deudas' },
      { id: PERMISSIONS.CUST_EDIT_LIMIT, label: 'Modificar límites de crédito' },
      { id: PERMISSIONS.CUST_DELETE, label: 'Eliminar clientes' },
    ]
  },
  {
    title: 'Suplidores y Compras',
    permissions: [
      { id: PERMISSIONS.SUP_VIEW, label: 'Ver suplidores, compras y cuentas por pagar' },
      { id: PERMISSIONS.SUP_MANAGE, label: 'Crear, editar y eliminar suplidores' },
      { id: PERMISSIONS.PUR_CREATE, label: 'Registrar compras (entrada de mercancía)' },
      { id: PERMISSIONS.PUR_CANCEL, label: 'Anular compras' },
      { id: PERMISSIONS.SUP_PAY, label: 'Pagar cuentas a suplidores' },
    ]
  },
  {
    title: 'Ventas y Reportes',
    permissions: [
      { id: PERMISSIONS.SALES_VIEW, label: 'Ver historial de ventas' },
      { id: PERMISSIONS.SALES_VOID, label: 'Anular/Cancelar ventas' },
      { id: PERMISSIONS.SALES_RETURN, label: 'Procesar devoluciones' },
      { id: PERMISSIONS.RPT_SUMMARY, label: 'Ver métricas resumen del dashboard' },
      { id: PERMISSIONS.RPT_FULL, label: 'Acceder a reportes completos' },
      { id: PERMISSIONS.RPT_EXPORT, label: 'Exportar reportes en PDF' },
    ]
  },
  {
    title: 'Ajustes de Negocio',
    permissions: [
      { id: PERMISSIONS.SET_VIEW, label: 'Ver configuraciones' },
      { id: PERMISSIONS.SET_EDIT, label: 'Editar información del negocio' },
      { id: PERMISSIONS.SET_LOGO, label: 'Cambiar logo' },
      { id: PERMISSIONS.SET_PRINTER, label: 'Configurar impresora' },
      { id: PERMISSIONS.SET_TAXES, label: 'Configurar impuestos y moneda' },
    ]
  },
  {
    title: 'Seguridad y Usuarios',
    permissions: [
      { id: PERMISSIONS.USR_VIEW, label: 'Ver lista de usuarios' },
      { id: PERMISSIONS.USR_MANAGE, label: 'Crear, editar o eliminar usuarios' },
      { id: PERMISSIONS.USR_ROLES, label: 'Gestionar roles y permisos' },
      { id: PERMISSIONS.SHIFTS_VIEW_OTHERS, label: 'Ver turnos de otros cajeros' },
      { id: PERMISSIONS.SHIFTS_FORCE, label: 'Forzar cierre de turnos ajenos' },
      { id: PERMISSIONS.SHIFTS_EXPENSES, label: 'Registrar gastos/salidas de caja' },
      { id: PERMISSIONS.AUDIT_VIEW, label: 'Ver bitácora de auditoría' },
      { id: PERMISSIONS.BACKUPS, label: 'Gestionar copias de seguridad' },
      { id: PERMISSIONS.SYS_UPDATE, label: 'Instalar actualizaciones' },
    ]
  }
];

const TOTAL_PERMISSIONS = PERMISSION_GROUPS.reduce((sum, g) => sum + g.permissions.length, 0);

export function RoleDialog({ role, isOpen, onClose, onSave }: RoleDialogProps) {
  const [name, setName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<Permission>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (role) {
      setName(role.name);
      setSelectedPermissions(new Set(role.permissions as Permission[]));
    } else {
      setName('');
      setSelectedPermissions(new Set());
    }
  }, [role, isOpen]);

  const togglePermission = (permissionId: Permission) => {
    setSelectedPermissions(prev => {
      const next = new Set(prev);
      if (next.has(permissionId)) {
        next.delete(permissionId);
      } else {
        next.add(permissionId);
      }
      return next;
    });
  };

  const toggleGroup = (groupPermissions: { id: Permission }[]) => {
    const groupIds = groupPermissions.map(p => p.id);
    const allSelected = groupIds.every(id => selectedPermissions.has(id));
    
    setSelectedPermissions(prev => {
      const next = new Set(prev);
      if (allSelected) {
        // Deselect all in group
        groupIds.forEach(id => next.delete(id));
      } else {
        // Select all in group
        groupIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('El nombre del rol es requerido');
      return;
    }

    if (selectedPermissions.size === 0) {
      toast.error('Debes seleccionar al menos un permiso');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: name.trim(),
        permissions: Array.from(selectedPermissions),
      };

      let result;
      if (role) {
        result = await ipc.invoke('roles:update', { roleId: role.id, data: payload }) as { success: boolean; message?: string };
        if (result.success) {
          toast.success('Rol actualizado');
          onSave();
        } else {
          toast.error(result.message || 'Error al actualizar rol');
        }
      } else {
        result = await ipc.invoke('roles:create', payload) as { success: boolean; message?: string };
        if (result.success) {
          toast.success('Rol creado');
          onSave();
        } else {
          toast.error(result.message || 'Error al crear rol');
        }
      }
    } catch (error) {
      console.error('Error saving role:', error);
      toast.error('Error de conexión');
    } finally {
      setIsSaving(false);
    }
  };

  const isSystem = role?.is_system;
  const isAdminRole = role?.name === 'Administrador';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border space-y-1 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-muted text-foreground flex items-center justify-center shrink-0">
              {isAdminRole
                ? <Lock className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
                : <ShieldCheck className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}
            </div>
            <DialogTitle className="text-lg font-semibold tracking-tight">
              {isAdminRole ? 'Rol Administrador' : role ? 'Editar Rol' : 'Crear Nuevo Rol'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            {isSystem
              ? 'Los roles del sistema son de solo lectura.'
              : 'Configura el nombre y los accesos específicos para este rol.'}
          </DialogDescription>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6" style={{ scrollbarWidth: 'thin' }}>
          <div className="space-y-2">
            <Label htmlFor="role-name" className="gap-1">
              Nombre del Rol
              {!isSystem && (
                <>
                  <span aria-hidden="true" className="text-muted-foreground">*</span>
                  <span className="sr-only">(obligatorio)</span>
                </>
              )}
            </Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Supervisor de Inventario"
              autoComplete="off"
              aria-required={!isSystem}
              aria-describedby={isSystem ? 'role-name-hint' : undefined}
              disabled={isSaving || isSystem}
              className="h-10 bg-background"
            />
            {isSystem && (
              <p id="role-name-hint" className="text-xs text-muted-foreground">
                El nombre de los roles del sistema no se puede cambiar.
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 pb-2 border-b border-border">
              <div className="min-w-0">
                <h3 id="permissions-heading" className="text-sm font-semibold tracking-tight">Permisos del Sistema</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isAdminRole
                    ? 'El rol Administrador siempre tiene todos los permisos.'
                    : 'Activa solo lo que este rol necesita para su trabajo.'}
                </p>
              </div>
              <span
                className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs font-medium text-foreground tabular-nums whitespace-nowrap shrink-0"
                aria-live="polite"
              >
                {selectedPermissions.size} de {TOTAL_PERMISSIONS}
              </span>
            </div>

            <div role="group" aria-labelledby="permissions-heading" className="grid grid-cols-1 gap-y-4">
              {PERMISSION_GROUPS.map((group, idx) => {
                const groupIds = group.permissions.map(p => p.id as Permission);
                const selectedInGroup = groupIds.filter(id => selectedPermissions.has(id)).length;
                const isGroupAllSelected = selectedInGroup === groupIds.length;
                const groupHeadingId = `perm-group-${idx}`;

                return (
                  <fieldset
                    key={idx}
                    aria-labelledby={groupHeadingId}
                    className="border border-border rounded-lg overflow-hidden min-w-0"
                  >
                    <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-muted/30">
                      <div className="flex items-center gap-2 min-w-0">
                        <h4 id={groupHeadingId} className="text-sm font-semibold tracking-tight text-foreground truncate">
                          {group.title}
                        </h4>
                        <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                          {selectedInGroup}/{groupIds.length}
                        </span>
                      </div>
                      {!isAdminRole && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleGroup(group.permissions as {id: Permission}[])}
                          disabled={isSaving}
                          aria-label={`${isGroupAllSelected ? 'Desmarcar todo' : 'Marcar todo'} en ${group.title}`}
                          className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground shrink-0"
                        >
                          {isGroupAllSelected ? 'Desmarcar' : 'Marcar Todo'}
                        </Button>
                      )}
                    </div>
                    <div className="divide-y divide-border">
                      {group.permissions.map((perm) => (
                        <div key={perm.id} className="flex items-center justify-between gap-3 px-4 py-1.5">
                          <Label
                            htmlFor={`perm-${perm.id}`}
                            className="text-sm font-normal text-foreground cursor-pointer flex-1 leading-snug py-1.5"
                          >
                            {perm.label}
                          </Label>
                          <Switch
                            id={`perm-${perm.id}`}
                            checked={selectedPermissions.has(perm.id as Permission)}
                            onCheckedChange={() => togglePermission(perm.id as Permission)}
                            disabled={isAdminRole || isSaving}
                          />
                        </div>
                      ))}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-border flex gap-3 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={isSaving} className="flex-1 h-10">
            {isAdminRole ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!isAdminRole && (
            <Button onClick={handleSubmit} disabled={!name.trim() || isSaving} className="flex-1 h-10 gap-2">
              {isSaving ? 'Guardando…' : role ? (
                <><Check className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />Guardar Cambios</>
              ) : (
                <><Plus className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />Crear Rol</>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
