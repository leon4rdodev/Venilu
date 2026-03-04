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
import { User, UserRole } from '@shared/types/models';

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
  });
  const [isSaving, setIsSaving] = useState(false);
  const { user: loggedInUser, setUser: setLoggedInUser } = useUser();

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        username: user.username,
        password: '',
        role: user.role,
      });
    } else {
      setFormData({
        name: '',
        username: '',
        password: '',
        role: 'employee' as UserRole,
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
    setFormData((prev) => ({ ...prev, role: value as UserRole }));
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
            setLoggedInUser({
              ...loggedInUser,
              name: formData.name,
              username: formData.username,
              role: formData.role,
            });
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
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4 border-b space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">
            {user ? 'Editar Usuario' : 'Agregar Usuario'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {user ? 'Modifica los detalles del usuario' : 'Completa la información del nuevo usuario'}
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Ej: Juan Pérez"
              disabled={isSaving}
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
            />
            {formData.password && formData.password.length < 4 && (
              <p className="text-xs text-destructive">La contraseña debe tener al menos 4 caracteres</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Rol *</Label>
            <Select value={formData.role} onValueChange={handleRoleChange} disabled={isSaving}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="employee">Vendedor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t flex gap-3">
          <Button variant="outline" onClick={onClose} disabled={isSaving} className="flex-1 h-11">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSave || isSaving} className="flex-1 h-11 gap-2">
            {isSaving ? 'Guardando...' : user ? (
              <><UserCheck className="h-4 w-4" />Guardar</>
            ) : (
              <><UserPlus className="h-4 w-4" />Agregar Usuario</>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
