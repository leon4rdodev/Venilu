import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export function useOnboarding() {
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        if (!window.ipcRenderer) {
          console.error('ipcRenderer is not available');
          setOnboardingCompleted(false);
          return;
        }

        const result = await window.ipcRenderer.invoke('onboarding:check') as {
          success: boolean;
          completed: boolean
        };

        if (result.success) {
          setOnboardingCompleted(result.completed);

          if (!result.completed && location.pathname !== '/onboarding') {
            setTimeout(() => {
              navigate('/onboarding', { replace: true });
            }, 1500);
          }
        }
      } catch (error) {
        console.error('Error checking onboarding:', error);
        setOnboardingCompleted(false);
      }
    };

    checkOnboarding();
  }, [location.pathname, navigate]);

  const completeOnboarding = () => {
    setOnboardingCompleted(true);
    navigate('/login', { replace: true });
  };

  return { onboardingCompleted, completeOnboarding };
}
