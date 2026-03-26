import { motion } from 'framer-motion';
import { CheckCircle2, ShoppingCart } from 'lucide-react';
import { STEPS } from '@renderer/features/onboarding/types/onboarding.types';

interface OnboardingSidebarProps {
    currentStep: number;
}

export function OnboardingSidebar({ currentStep }: OnboardingSidebarProps) {
    return (
        <motion.aside
            className="hidden lg:flex lg:w-[32%] flex-col justify-between relative overflow-hidden"
            initial={{ x: -60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{
                background:
                    'linear-gradient(145deg, oklch(0.10 0.04 260), oklch(0.16 0.07 265), oklch(0.12 0.05 255))',
            }}
        >
            {/* Grid overlay */}
            <div
                className="absolute inset-0 opacity-[0.04]"
                style={{
                    backgroundImage:
                        'linear-gradient(oklch(0.9 0.1 260) 1px, transparent 1px), linear-gradient(90deg, oklch(0.9 0.1 260) 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                }}
            />
            {/* Glow */}
            <div
                className="absolute top-1/3 -left-20 w-72 h-72 rounded-full opacity-15 blur-3xl"
                style={{ background: 'oklch(0.6 0.22 260)' }}
            />

            {/* Logo */}
            <div className="relative z-10 p-8">
                <div className="flex items-center gap-3">
                    <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: 'oklch(0.6 0.22 260)' }}
                    >
                        <ShoppingCart className="w-4 h-4 text-white" />
                    </div>
                    <span
                        className="text-xl font-bold"
                        style={{ color: 'oklch(0.97 0.01 240)' }}
                    >
                        Venilu
                    </span>
                </div>
            </div>

            {/* Step list */}
            <div className="relative z-10 px-8 space-y-1">
                <p
                    className="text-xs font-semibold uppercase tracking-widest mb-6"
                    style={{ color: 'oklch(0.45 0.05 260)' }}
                >
                    Configuración inicial
                </p>
                {STEPS.map((step, i) => {
                    const done = i < currentStep;
                    const active = i === currentStep;
                    return (
                        <div key={i} className="flex items-start gap-3 py-2.5">
                            <div className="relative flex flex-col items-center">
                                <motion.div
                                    animate={{
                                        background: done || active
                                            ? 'oklch(0.6 0.22 260 / 0.2)'
                                            : 'oklch(0.22 0.05 260 / 0.6)',
                                        borderColor: active || done
                                            ? 'oklch(0.6 0.22 260)'
                                            : 'oklch(0.32 0.05 260)',
                                        ...(done && { background: 'oklch(0.6 0.22 260)' }),
                                    }}
                                    transition={{ duration: 0.3 }}
                                    className="w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0"
                                >
                                    {done ? (
                                        <CheckCircle2 className="w-4 h-4 text-white" />
                                    ) : (
                                        <step.icon
                                            className="w-4 h-4"
                                            style={{
                                                color: active
                                                    ? 'oklch(0.75 0.18 260)'
                                                    : 'oklch(0.4 0.04 260)',
                                            }}
                                        />
                                    )}
                                </motion.div>
                                {i < STEPS.length - 1 && (
                                    <div
                                        className="w-px h-8 mt-1"
                                        style={{
                                            background: i < currentStep
                                                ? 'oklch(0.6 0.22 260 / 0.6)'
                                                : 'oklch(0.25 0.04 260)',
                                        }}
                                    />
                                )}
                            </div>
                            <div className="pt-0.5">
                                <p
                                    className="text-sm font-medium"
                                    style={{
                                        color: active
                                            ? 'oklch(0.97 0.01 240)'
                                            : done
                                                ? 'oklch(0.7 0.08 260)'
                                                : 'oklch(0.42 0.04 260)',
                                    }}
                                >
                                    {step.title}
                                </p>
                                <p
                                    className="text-xs"
                                    style={{
                                        color: active
                                            ? 'oklch(0.62 0.06 260)'
                                            : 'oklch(0.35 0.04 260)',
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
                <p className="text-xs" style={{ color: 'oklch(0.35 0.03 260)' }}>
                    Venilu v1.0 · © 2025
                </p>
            </div>
        </motion.aside>
    );
}
