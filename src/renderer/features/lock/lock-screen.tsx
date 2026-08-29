import React, { useState, useEffect, useRef } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, LogOut } from 'lucide-react';
import { User } from '@shared/types/models';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Button } from '@components/ui/button';
import { useUser } from '@renderer/features/auth';
import { useLock } from './use-lock';

/**
 * Overlay de pantalla completa que cubre toda la app mientras la caja está
 * bloqueada. Mismo lienzo que el login (gradiente oscuro + grid + orbes);
 * solo se sale desbloqueando con la contraseña del usuario actual, o
 * cerrando sesión desde el enlace inferior.
 */
export function LockScreen() {
  const { locked } = useLock();
  const { user } = useUser();

  if (!locked || !user) return null;

  // La tarjeta se monta fresca en cada bloqueo: contraseña, error y toggle
  // del ojo arrancan limpios sin necesidad de resetear estado con efectos.
  return <LockOverlay user={user} />;
}

function LockOverlay({ user }: { user: User }) {
  const { unlock } = useLock();
  const { logout } = useUser();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Foco directo al campo de contraseña al bloquear (patrón del login)
  useEffect(() => {
    const id = setTimeout(() => passwordRef.current?.focus(), 50);
    return () => clearTimeout(id);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || isLoading) return;
    setError('');
    setIsLoading(true);
    const result = await unlock(password);
    if (!result.success) {
      setError(result.message || 'Contraseña incorrecta.');
      setPassword('');
      setIsLoading(false);
      passwordRef.current?.focus();
    }
    // En éxito el overlay se desmonta — no hace falta tocar más estado
  };

  const initial = (user.name?.[0] ?? user.username?.[0] ?? '?').toUpperCase();
  const roleLabel = user.role_entity?.name || user.role || null;

  return (
    <div
      data-lock-screen
      className="fixed inset-0 z-[999] flex flex-col items-center justify-center overflow-hidden p-6"
      style={{
        background: 'linear-gradient(160deg, oklch(0.07 0 0), oklch(0.13 0 0))',
      }}
    >
      {/* Grid decorativo con máscara */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(oklch(0.98 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(0.98 0 0) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'radial-gradient(ellipse 80% 70% at 50% 40%, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 50% 40%, black 30%, transparent 75%)',
        }}
      />

      {/* Orbes de luz */}
      <div
        className="absolute -top-24 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full opacity-[0.12] blur-3xl pointer-events-none"
        style={{ background: 'oklch(0.6 0 0)' }}
      />
      <div
        className="absolute bottom-0 -right-32 w-80 h-80 rounded-full opacity-[0.08] blur-3xl pointer-events-none"
        style={{ background: 'oklch(0.45 0 0)' }}
      />

      {/* Tarjeta central */}
      <div className="relative z-10 w-full max-w-sm">
        <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 space-y-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
              <Lock className="w-6 h-6" strokeWidth={1.75} />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight">Caja bloqueada</h2>
              <p className="text-sm text-muted-foreground">
                Ingresa tu contraseña para desbloquear
              </p>
            </div>
          </div>

          {/* Usuario actual */}
          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
            <div className="w-10 h-10 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name || user.username}</p>
              {roleLabel && (
                <p className="text-xs text-muted-foreground capitalize truncate">{roleLabel}</p>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lock-password" className="text-sm font-medium">
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="lock-password"
                  ref={passwordRef}
                  placeholder="••••••••"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-11"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" strokeWidth={1.75} />
                  ) : (
                    <Eye className="w-4 h-4" strokeWidth={1.75} />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/8 border border-destructive/20 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-sm font-semibold"
              disabled={isLoading || password.length === 0}
            >
              {isLoading ? 'Verificando...' : 'Desbloquear'}
            </Button>
          </form>
        </div>

        {/* Salida discreta: cerrar sesión (también desbloquea) */}
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => void logout()}
            className="flex items-center gap-1.5 text-xs transition-colors hover:underline"
            style={{ color: 'oklch(0.6 0 0)' }}
          >
            <LogOut className="w-3.5 h-3.5" strokeWidth={1.75} />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
