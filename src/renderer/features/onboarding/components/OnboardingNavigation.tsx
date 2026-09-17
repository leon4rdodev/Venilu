import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { Button } from '@components/ui/button';
import { STEPS } from '@renderer/features/onboarding/types/onboarding.types';

interface OnboardingNavigationProps {
    currentStep: number;
    canProceed: boolean;
    isLoading: boolean;
    onBack: () => void;
    onNext: () => void;
}

export function OnboardingNavigation({
    currentStep,
    canProceed,
    isLoading,
    onBack,
    onNext,
}: OnboardingNavigationProps) {
    const isLastStep = currentStep === STEPS.length - 1;
    const isFirstStep = currentStep === 0;
    const nextTitle = STEPS[currentStep + 1]?.title;

    return (
        <footer className="px-8 lg:px-16 py-5 border-t border-border flex items-center justify-between gap-4 bg-background">
            <Button
                type="button"
                variant="ghost"
                onClick={onBack}
                disabled={isFirstStep || isLoading}
                className="h-10 gap-2 px-4"
            >
                <ArrowLeft className="w-4 h-4" aria-hidden />
                Atrás
            </Button>

            <div className="flex items-center gap-4 min-w-0">
                <span className="text-xs text-muted-foreground hidden sm:block truncate">
                    {isLastStep
                        ? 'Último paso'
                        : nextTitle
                            ? `Siguiente: ${nextTitle}`
                            : `Paso ${currentStep + 1} de ${STEPS.length}`}
                </span>
                <Button
                    type="button"
                    onClick={onNext}
                    disabled={!canProceed || isLoading}
                    aria-busy={isLoading || undefined}
                    className="h-10 gap-2 px-5 min-w-[9rem]"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden />
                            Guardando…
                        </>
                    ) : isLastStep ? (
                        <>
                            <Check className="w-4 h-4" aria-hidden />
                            Finalizar
                        </>
                    ) : (
                        <>
                            {isFirstStep ? 'Comenzar' : 'Siguiente'}
                            <ArrowRight className="w-4 h-4" aria-hidden />
                        </>
                    )}
                </Button>
            </div>
        </footer>
    );
}
