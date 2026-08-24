import { CheckCircle2, ShoppingCart } from 'lucide-react';
import { STEPS } from '@renderer/features/onboarding/types/onboarding.types';

interface OnboardingSidebarProps {
    currentStep: number;
}

export function OnboardingSidebar({ currentStep }: OnboardingSidebarProps) {
    return (
        <aside
            className="hidden lg:flex lg:w-[32%] flex-col justify-between relative overflow-hidden"
            style={{
                background:
                    'linear-gradient(160deg, oklch(0.08 0 0), oklch(0.145 0 0))',
            }}
        >
            {/* Grid overlay */}
            <div
                className="absolute inset-0 opacity-[0.04]"
                style={{
                    backgroundImage:
                        'linear-gradient(oklch(0.98 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(0.98 0 0) 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                }}
            />
            {/* Glow */}
            <div
                className="absolute top-1/3 -left-20 w-72 h-72 rounded-full opacity-[0.12] blur-3xl"
                style={{ background: 'oklch(0.55 0 0)' }}
            />

            {/* Logo */}
            <div className="relative z-10 p-8">
                <div className="flex items-center gap-3">
                    <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center"
                        style={{ background: 'oklch(1 0 0)' }}
                    >
                        <ShoppingCart className="w-4 h-4" style={{ color: 'oklch(0.145 0 0)' }} />
                    </div>
                    <span
                        className="text-xl font-bold tracking-tight"
                        style={{ color: 'oklch(0.985 0 0)' }}
                    >
                        Venilu
                    </span>
                </div>
            </div>

            {/* Step list */}
            <div className="relative z-10 px-8 space-y-1">
                <p
                    className="text-xs font-semibold uppercase tracking-widest mb-6"
                    style={{ color: 'oklch(0.5 0 0)' }}
                >
                    Configuración inicial
                </p>
                {STEPS.map((step, i) => {
                    const done = i < currentStep;
                    const active = i === currentStep;
                    return (
                        <div key={i} className="flex items-start gap-3 py-2.5">
                            <div className="relative flex flex-col items-center">
                                <div
                                    style={{
                                        background: done
                                            ? 'oklch(0.985 0 0)'
                                            : active
                                                ? 'oklch(1 0 0 / 0.1)'
                                                : 'oklch(1 0 0 / 0.04)',
                                        borderColor: active || done
                                            ? 'oklch(0.985 0 0)'
                                            : 'oklch(0.35 0 0)',
                                    }}
                                    className="w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0"
                                >
                                    {done ? (
                                        <CheckCircle2 className="w-4 h-4" style={{ color: 'oklch(0.145 0 0)' }} />
                                    ) : (
                                        <step.icon
                                            className="w-4 h-4"
                                            style={{
                                                color: active
                                                    ? 'oklch(0.985 0 0)'
                                                    : 'oklch(0.45 0 0)',
                                            }}
                                        />
                                    )}
                                </div>
                                {i < STEPS.length - 1 && (
                                    <div
                                        className="w-px h-8 mt-1"
                                        style={{
                                            background: i < currentStep
                                                ? 'oklch(0.985 0 0 / 0.5)'
                                                : 'oklch(0.28 0 0)',
                                        }}
                                    />
                                )}
                            </div>
                            <div className="pt-0.5">
                                <p
                                    className="text-sm font-medium"
                                    style={{
                                        color: active
                                            ? 'oklch(0.985 0 0)'
                                            : done
                                                ? 'oklch(0.72 0 0)'
                                                : 'oklch(0.45 0 0)',
                                    }}
                                >
                                    {step.title}
                                </p>
                                <p
                                    className="text-xs"
                                    style={{
                                        color: active
                                            ? 'oklch(0.65 0 0)'
                                            : 'oklch(0.38 0 0)',
                                    }}
                                >
                                    {step.description}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer */}
            <div className="relative z-10 p-8">
                <p className="text-xs" style={{ color: 'oklch(0.38 0 0)' }}>
                    Venilu v1.0 · © 2025
                </p>
            </div>
        </aside>
    );
}
