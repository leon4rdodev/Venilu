import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
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

    return (
        <div className="px-8 lg:px-16 py-6 border-t border-border/50 flex items-center justify-between">
            <Button
                variant="ghost"
                onClick={onBack}
                disabled={currentStep === 0}
                className="gap-2"
            >
                <ArrowLeft className="w-4 h-4" />
                Atrás
            </Button>

            <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground hidden sm:block">
                    Paso {currentStep + 1} de {STEPS.length}
                </span>
                <Button
                    onClick={onNext}
                    disabled={!canProceed || isLoading}
                    className="gap-2 min-w-[120px]"
                >
                    {isLoading ? (
                        "Guardando..."
                    ) : isLastStep ? (
                        <><CheckCircle2 className="w-4 h-4" />Finalizar</>
                    ) : (
                        <>Siguiente<ArrowRight className="w-4 h-4" /></>
                    )}
                </Button>
            </div>
        </div>
    );
}
