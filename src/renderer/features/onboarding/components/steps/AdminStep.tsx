import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { capitalizeWords } from '@lib/utils';
import type { AdminData } from '@renderer/features/onboarding/types/onboarding.types';

interface AdminStepProps {
    adminData: AdminData;
    setAdminData: React.Dispatch<React.SetStateAction<AdminData>>;
    showPassword: boolean;
    setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
    showConfirmPassword: boolean;
    setShowConfirmPassword: React.Dispatch<React.SetStateAction<boolean>>;
    passwordStrength: () => { label: string; color: string; w: string } | null;
}

const FOCUS_RING =
    'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/** Accessible show/hide toggle sized to a full 32px target inside the field. */
function VisibilityToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
    return (
        <button
            type="button"
            onClick={onToggle}
            aria-label={shown ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={shown}
            className={`absolute right-1 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors ${FOCUS_RING}`}
        >
            {shown ? (
                <EyeOff className="w-4 h-4" strokeWidth={1.75} aria-hidden />
            ) : (
                <Eye className="w-4 h-4" strokeWidth={1.75} aria-hidden />
            )}
        </button>
    );
}

export function AdminStep({
    adminData,
    setAdminData,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    passwordStrength,
}: AdminStepProps) {
    const strength = passwordStrength();
    const mismatch =
        adminData.confirmPassword.length > 0 && adminData.password !== adminData.confirmPassword;
    const matches =
        adminData.confirmPassword.length > 0 && adminData.password === adminData.confirmPassword;

    return (
        <div className="space-y-5">
            <p className="text-xs text-muted-foreground">
                Los campos marcados con <span aria-hidden>*</span>
                <span className="sr-only">asterisco</span> son obligatorios.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-sm">
                        Nombre completo <span aria-hidden>*</span>
                    </Label>
                    <Input
                        id="name"
                        placeholder="Juan Pérez"
                        autoComplete="name"
                        required
                        value={adminData.name}
                        className="h-10"
                        onChange={(e) =>
                            setAdminData(p => ({ ...p, name: capitalizeWords(e.target.value) }))
                        }
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="username" className="text-sm">
                        Usuario <span aria-hidden>*</span>
                    </Label>
                    <Input
                        id="username"
                        placeholder="admin"
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        required
                        value={adminData.username}
                        className="h-10"
                        aria-describedby="username-hint"
                        onChange={(e) =>
                            setAdminData(p => ({ ...p, username: e.target.value }))
                        }
                    />
                    <p id="username-hint" className="text-xs text-muted-foreground">
                        Lo usarás para iniciar sesión.
                    </p>
                </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm">
                    Contraseña <span aria-hidden>*</span>{' '}
                    <span className="text-muted-foreground font-normal">(mín. 4 caracteres)</span>
                </Label>
                <div className="relative">
                    <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        required
                        minLength={4}
                        value={adminData.password}
                        className="h-10 pr-11"
                        aria-describedby={strength ? 'password-strength' : undefined}
                        onChange={(e) =>
                            setAdminData(p => ({ ...p, password: e.target.value }))
                        }
                    />
                    <VisibilityToggle shown={showPassword} onToggle={() => setShowPassword(v => !v)} />
                </div>
                {strength && (
                    <div className="space-y-1 pt-1">
                        <div aria-hidden className="h-1 bg-muted rounded-full overflow-hidden">
                            <div
                                className={`h-full ${strength.color} rounded-full transition-[width] duration-300 motion-reduce:transition-none`}
                                style={{ width: strength.w }}
                            />
                        </div>
                        <p id="password-strength" className="text-xs text-muted-foreground" aria-live="polite">
                            Seguridad: {strength.label}
                        </p>
                    </div>
                )}
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-sm">
                    Confirmar contraseña <span aria-hidden>*</span>
                </Label>
                <div className="relative">
                    <Input
                        id="confirm"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        required
                        value={adminData.confirmPassword}
                        className="h-10 pr-11"
                        aria-invalid={mismatch || undefined}
                        aria-describedby={mismatch ? 'confirm-error' : undefined}
                        onChange={(e) =>
                            setAdminData(p => ({ ...p, confirmPassword: e.target.value }))
                        }
                    />
                    <VisibilityToggle
                        shown={showConfirmPassword}
                        onToggle={() => setShowConfirmPassword(v => !v)}
                    />
                </div>
                {mismatch && (
                    <p id="confirm-error" role="alert" className="text-xs text-destructive">
                        Las contraseñas no coinciden
                    </p>
                )}
                {matches && (
                    <p className="text-xs text-muted-foreground">Las contraseñas coinciden</p>
                )}
            </div>
        </div>
    );
}
