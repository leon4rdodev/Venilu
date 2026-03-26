import { motion } from 'framer-motion';
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

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-sm">Nombre completo *</Label>
                    <Input
                        id="name"
                        placeholder="Juan Pérez"
                        value={adminData.name}
                        className="h-10"
                        onChange={(e) =>
                            setAdminData(p => ({ ...p, name: capitalizeWords(e.target.value) }))
                        }
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="username" className="text-sm">Usuario *</Label>
                    <Input
                        id="username"
                        placeholder="admin"
                        value={adminData.username}
                        className="h-10"
                        onChange={(e) =>
                            setAdminData(p => ({ ...p, username: e.target.value }))
                        }
                    />
                </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm">
                    Contraseña *{' '}
                    <span className="text-muted-foreground font-normal">(mín. 4 caracteres)</span>
                </Label>
                <div className="relative">
                    <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={adminData.password}
                        className="h-10 pr-10"
                        onChange={(e) =>
                            setAdminData(p => ({ ...p, password: e.target.value }))
                        }
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                </div>
                {strength && (
                    <div className="space-y-1 pt-1">
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                            <motion.div
                                className={`h-full ${strength.color} rounded-full`}
                                initial={{ width: 0 }}
                                animate={{ width: undefined }}
                                style={{ width: strength.w }}
                                transition={{ duration: 0.3 }}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">{strength.label}</p>
                    </div>
                )}
            </div>

            {/* Confirm password */}
            <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-sm">Confirmar contraseña *</Label>
                <div className="relative">
                    <Input
                        id="confirm"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={adminData.confirmPassword}
                        className="h-10 pr-10"
                        onChange={(e) =>
                            setAdminData(p => ({ ...p, confirmPassword: e.target.value }))
                        }
                    />
                    <button
                        type="button"
                        onClick={() => setShowConfirmPassword(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                </div>
                {adminData.confirmPassword && adminData.password !== adminData.confirmPassword && (
                    <p className="text-xs text-destructive">Las contraseñas no coinciden</p>
                )}
            </div>
        </div>
    );
}
