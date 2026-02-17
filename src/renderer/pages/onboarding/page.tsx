import { OnboardingWizard } from '@components/onboarding/OnboardingWizard';

interface OnboardingPageProps {
    onComplete: () => void;
}

export default function OnboardingPage({ onComplete }: OnboardingPageProps) {
    return <OnboardingWizard onComplete={onComplete} />;
}
