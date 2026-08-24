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

    return (
        <div className="min-h-screen flex bg-background overflow-hidden">
            <OnboardingSidebar currentStep={wizard.currentStep} />

            <div className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Mobile step indicator */}
                <div className="lg:hidden px-6 pt-6">
                    <div className="flex items-center gap-2">
                        {STEPS.map((_, i) => (
                            <div
                                key={i}
                                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                                    i <= wizard.currentStep ? 'bg-primary' : 'bg-muted'
                                }`}
                            />
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        Paso {wizard.currentStep + 1} de {STEPS.length}
                    </p>
                </div>

                {/* Step content */}
                <div className="flex-1 overflow-y-auto px-8 lg:px-16 pt-12 pb-6">
                    <div className="max-w-xl space-y-6">
                            {/* Step header */}
                            <div className="space-y-1 mb-8">
                                <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-widest mb-2">
                                    {(() => {
                                        const S = STEPS[wizard.currentStep];
                                        return <><S.icon className="w-3.5 h-3.5" />{S.description}</>;
                                    })()}
                                </div>
                                <h2 className="text-3xl font-bold tracking-tight">
                                    {STEPS[wizard.currentStep].title}
                                </h2>
                            </div>

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
                </div>

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
