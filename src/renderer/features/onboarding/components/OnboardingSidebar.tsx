import { Check, ShoppingCart } from 'lucide-react';
import { STEPS } from '@renderer/features/onboarding/types/onboarding.types';

interface OnboardingSidebarProps {
    currentStep: number;
}

// Fixed dark canvas (independent of the app theme), so the grays are tuned by
// hand: every text tone stays above 4.5:1 against the ~oklch(0.1) background.
const INK = {
    primary: 'oklch(0.985 0 0)',
    done: 'oklch(0.78 0 0)',
    secondary: 'oklch(0.7 0 0)',
    muted: 'oklch(0.58 0 0)',
    hairline: 'oklch(0.3 0 0)',
};

export function OnboardingSidebar({ currentStep }: OnboardingSidebarProps) {
    return (
        <aside
            aria-label="Progreso de la configuración"
            className="hidden lg:flex lg:w-[32%] flex-col justify-between relative overflow-hidden"
            style={{
                background:
                    'linear-gradient(160deg, oklch(0.08 0 0), oklch(0.145 0 0))',
            }}
        >
            {/* Grid overlay */}
            <div
                aria-hidden
                className="absolute inset-0 opacity-[0.04]"
                style={{
                    backgroundImage:
                        'linear-gradient(oklch(0.98 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(0.98 0 0) 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                }}
            />
            {/* Glow */}
            <div
                aria-hidden
                className="absolute top-1/3 -left-20 w-72 h-72 rounded-full opacity-[0.12] blur-3xl pointer-events-none"
                style={{ background: 'oklch(0.55 0 0)' }}
            />

            {/* Logo */}
            <div className="relative z-10 p-8">
                <div className="flex items-center gap-3">
                    <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ background: 'oklch(1 0 0)' }}
                    >
                        <ShoppingCart
                            className="w-4 h-4"
                            strokeWidth={2}
                            style={{ color: 'oklch(0.145 0 0)' }}
                            aria-hidden
                        />
                    </div>
                    <span
                        className="text-xl font-bold tracking-tight"
                        style={{ color: INK.primary }}
                    >
                        Venilu
                    </span>
                </div>
            </div>

            {/* Step list */}
            <div className="relative z-10 px-8">
                <p
                    className="text-xs font-medium mb-6 tabular-nums"
                    style={{ color: INK.muted }}
                >
                    Configuración inicial · Paso {currentStep + 1} de {STEPS.length}
                </p>
                <ol className="space-y-1">
                    {STEPS.map((step, i) => {
                        const done = i < currentStep;
                        const active = i === currentStep;
                        const status = done ? 'Completado' : active ? 'Paso actual' : 'Pendiente';
                        return (
                            <li
                                key={i}
                                aria-current={active ? 'step' : undefined}
                                className="flex items-start gap-3 py-2.5"
                            >
                                <div className="relative flex flex-col items-center">
                                    <div
                                        aria-hidden
                                        style={{
                                            background: done
                                                ? INK.primary
                                                : active
                                                    ? 'oklch(1 0 0 / 0.1)'
                                                    : 'oklch(1 0 0 / 0.04)',
                                            borderColor: active || done
                                                ? INK.primary
                                                : 'oklch(0.38 0 0)',
                                        }}
                                        className="w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors duration-300"
                                    >
                                        {done ? (
                                            <Check
                                                className="w-4 h-4"
                                                strokeWidth={2.5}
                                                style={{ color: 'oklch(0.145 0 0)' }}
                                            />
                                        ) : (
                                            <step.icon
                                                className="w-4 h-4"
                                                strokeWidth={1.75}
                                                style={{
                                                    color: active ? INK.primary : INK.muted,
                                                }}
                                            />
                                        )}
                                    </div>
                                    {i < STEPS.length - 1 && (
                                        <div
                                            aria-hidden
                                            className="w-px h-8 mt-1 transition-colors duration-300"
                                            style={{
                                                background: done
                                                    ? 'oklch(0.985 0 0 / 0.5)'
                                                    : INK.hairline,
                                            }}
                                        />
                                    )}
                                </div>
                                <div className="pt-0.5 min-w-0">
                                    <p
                                        className="text-sm font-medium"
                                        style={{
                                            color: active
                                                ? INK.primary
                                                : done
                                                    ? INK.done
                                                    : INK.muted,
                                        }}
                                    >
                                        {step.title}
                                        <span className="sr-only"> — {status}</span>
                                    </p>
                                    <p
                                        className="text-xs mt-0.5"
                                        style={{
                                            color: active ? INK.secondary : INK.muted,
                                        }}
                                    >
                                        {step.description}
                                    </p>
                                </div>
                            </li>
                        );
                    })}
                </ol>
            </div>

            {/* Footer */}
            <div className="relative z-10 p-8">
                <p className="text-xs" style={{ color: INK.muted }}>
                    Venilu · © {new Date().getFullYear()}
                </p>
            </div>
        </aside>
    );
}
