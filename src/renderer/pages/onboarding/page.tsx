import { OnboardingWizard } from '@renderer/features/onboarding';

interface OnboardingPageProps {
    onComplete: () => void;
}

export default function OnboardingPage({ onComplete }: OnboardingPageProps) {
    return <OnboardingWizard onComplete={onComplete} />;
}
