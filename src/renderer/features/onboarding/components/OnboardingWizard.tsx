import { useOnboardingWizard } from '@renderer/features/onboarding/hooks/use-onboarding-wizard';
import { STEPS } from '@renderer/features/onboarding/types/onboarding.types';

import { OnboardingSidebar } from './OnboardingSidebar';
import { OnboardingNavigation } from './OnboardingNavigation';
import { WelcomeStep } from './steps/WelcomeStep';
import { AdminStep } from './steps/AdminStep';
import { BusinessStep } from './steps/BusinessStep';
import { PrinterStep } from './steps/PrinterStep';

interface OnboardingWizardProps {
    onComplete: () => void;
}

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
    const wizard = useOnboardingWizard(onComplete);
    const step = STEPS[wizard.currentStep];
    const StepIcon = step.icon;
    const headingId = 'onboarding-step-title';

    return (
        <div className="min-h-screen flex bg-background overflow-hidden">
            <OnboardingSidebar currentStep={wizard.currentStep} />

            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Compact progress (narrow windows, where the sidebar is hidden) */}
                <div className="lg:hidden px-6 pt-6">
                    <div
                        role="progressbar"
                        aria-label="Progreso de la configuración"
                        aria-valuemin={1}
                        aria-valuemax={STEPS.length}
                        aria-valuenow={wizard.currentStep + 1}
                        aria-valuetext={`Paso ${wizard.currentStep + 1} de ${STEPS.length}: ${step.title}`}
                        className="flex items-center gap-2"
                    >
                        {STEPS.map((_, i) => (
                            <div
                                key={i}
                                className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                                    i <= wizard.currentStep ? 'bg-primary' : 'bg-muted'
                                }`}
                            />
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 tabular-nums">
                        Paso {wizard.currentStep + 1} de {STEPS.length}
                    </p>
                </div>

                {/* Step content */}
                <main
                    className="flex-1 overflow-y-auto px-8 lg:px-16 pt-12 pb-8"
                    aria-labelledby={headingId}
                >
                    <div className="max-w-xl">
                        {/* Step header */}
                        <header className="mb-8 space-y-2">
                            <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground tabular-nums">
                                <span
                                    aria-hidden
                                    className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-foreground"
                                >
                                    <StepIcon className="w-3.5 h-3.5" strokeWidth={1.75} />
                                </span>
                                Paso {wizard.currentStep + 1} de {STEPS.length}
                            </p>
                            <h1
                                id={headingId}
                                className="text-3xl font-semibold tracking-tight text-foreground"
                            >
                                {step.title}
                            </h1>
                            <p className="text-sm text-muted-foreground">{step.description}</p>
                        </header>

                        {/* Step panels */}
                        {wizard.currentStep === 0 && <WelcomeStep />}

                        {wizard.currentStep === 1 && (
                            <AdminStep
                                adminData={wizard.adminData}
                                setAdminData={wizard.setAdminData}
                                showPassword={wizard.showPassword}
                                setShowPassword={wizard.setShowPassword}
                                showConfirmPassword={wizard.showConfirmPassword}
                                setShowConfirmPassword={wizard.setShowConfirmPassword}
                                passwordStrength={wizard.passwordStrength}
                            />
                        )}

                        {wizard.currentStep === 2 && (
                            <BusinessStep
                                businessData={wizard.businessData}
                                setBusinessData={wizard.setBusinessData}
                                handleLogoUpload={wizard.handleLogoUpload}
                                removeLogo={wizard.removeLogo}
                            />
                        )}

                        {wizard.currentStep === 3 && (
                            <PrinterStep
                                printers={wizard.printers}
                                printerData={wizard.printerData}
                                setPrinterData={wizard.setPrinterData}
                                testPrint={wizard.testPrint}
                                isLoading={wizard.isLoading}
                            />
                        )}
                    </div>
                </main>

                <OnboardingNavigation
                    currentStep={wizard.currentStep}
                    canProceed={wizard.canProceed()}
                    isLoading={wizard.isLoading}
                    onBack={wizard.handleBack}
                    onNext={wizard.handleNext}
                />
            </div>
        </div>
    );
}
