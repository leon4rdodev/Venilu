import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@components/ui/dialog';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { UserCheck, UserPlus } from 'lucide-react';
import { capitalizeWords } from '@lib/utils';
import { toast } from 'sonner';
import { useUser } from '@renderer/features/auth';
import { User, UserRole, Role } from '@shared/types/models';
import { ipc } from '@lib/ipc';

interface LocalUser extends User {}

interface UserDialogProps {
  user: LocalUser | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function UserDialog({ user, isOpen, onClose, onSave }: UserDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: 'employee' as UserRole,
    role_id: '',
  });
  const [roles, setRoles] = useState<Role[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const { user: loggedInUser, setUser: setLoggedInUser } = useUser();

  useEffect(() => {
    if (isOpen) {
      ipc.invoke('roles:list').then((res: any) => {
        if (res.success && res.data) {
          setRoles(res.data);
        }
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        username: user.username,
        password: '',
        role: user.role,
        role_id: user.role_id || '',
      });
    } else {
      setFormData({
        name: '',
        username: '',
        password: '',
        role: 'employee' as UserRole,
        role_id: '',
      });
    }
  }, [user, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [id]: id === 'name' ? capitalizeWords(value) : value,
    }));
  };

  const handleRoleChange = (value: string) => {
    const selectedRole = roles.find(r => r.id === value);
    // Legacy mapping: if the system role is "Administrador", string role is "admin"
    const legacyRoleStr = selectedRole?.name === 'Administrador' ? 'admin' : 'employee';
    
    setFormData((prev) => ({ 
      ...prev, 
      role_id: value,
      role: legacyRoleStr as UserRole 
    }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast.error('El nombre es requerido');
      return false;
    }
    if (!formData.username.trim()) {
      toast.error('El nombre de usuario es requerido');
      return false;
    }
    if (!formData.role_id) {
      toast.error('Debes asignar un rol al usuario');
      return false;
    }
    if (!user && !formData.password.trim()) {
      toast.error('La contraseña es requerida para nuevos usuarios');
      return false;
    }
    if (formData.password && formData.password.length < 4) {
      toast.error('La contraseña debe tener al menos 4 caracteres');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      let result;
      if (user) {
        result = await window.ipcRenderer.invoke('update-user', {
          userId: user.id,
          userData: formData,
        }) as { success: boolean; message?: string };

        if (result.success) {
          toast.success('Usuario actualizado exitosamente');
          if (loggedInUser && loggedInUser.id === user.id) {
            // Re-fetch the session user from main so local state (including
            // permissions) matches the database.
            const refreshed = await window.ipcRenderer.invoke('session:refresh') as {
              success: boolean;
              data?: typeof loggedInUser;
            };
            if (refreshed.success && refreshed.data) {
              setLoggedInUser(refreshed.data);
            }
          }
          onSave();
          onClose();
        } else {
          toast.error('Error al actualizar usuario', {
            description: result.message || 'Ocurrió un error inesperado',
          });
        }
      } else {
        result = await window.ipcRenderer.invoke('create-user', formData) as { success: boolean; message?: string };

        if (result.success) {
          toast.success('Usuario creado exitosamente');
          onSave();
          onClose();
        } else {
          toast.error('Error al crear usuario', {
            description: result.message || 'Ocurrió un error inesperado',
          });
        }
      }
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error('Error de conexión', { description: 'No se pudo guardar el usuario' });
    } finally {
      setIsSaving(false);
    }
  };

  const canSave = formData.name.trim() && formData.username.trim() && (user || formData.password.trim());

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border space-y-1 shrink-0">
          <h2 className="text-lg font-semibold tracking-tight">
            {user ? 'Editar Usuario' : 'Agregar Usuario'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {user ? 'Modifica los detalles del usuario' : 'Completa la información del nuevo usuario'}
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 flex-1 overflow-y-auto min-h-0">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Ej: Juan Pérez"
              disabled={isSaving}
              className="h-10 bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Nombre de Usuario *</Label>
            <Input
              id="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Ej: juan.perez"
              disabled={isSaving}
              className="h-10 bg-background"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña {!user && '*'}</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder={user ? 'Dejar en blanco para no cambiar' : 'Ingresa una contraseña'}
              disabled={isSaving}
              className="h-10 bg-background"
            />
            {formData.password && formData.password.length < 4 && (
              <p className="text-xs text-destructive">La contraseña debe tener al menos 4 caracteres</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Rol *</Label>
            <Select value={formData.role_id} onValueChange={handleRoleChange} disabled={isSaving || roles.length === 0}>
              <SelectTrigger id="role" className="h-10 bg-background w-full">
                <SelectValue placeholder="Selecciona un rol" />
              </SelectTrigger>
              <SelectContent>
                {roles.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-border flex gap-3 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={isSaving} className="flex-1 h-10">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSave || isSaving} className="flex-1 h-10 gap-2">
            {isSaving ? 'Guardando...' : user ? (
              <><UserCheck className="h-4 w-4" strokeWidth={1.75} />Guardar</>
            ) : (
              <><UserPlus className="h-4 w-4" strokeWidth={1.75} />Agregar Usuario</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
