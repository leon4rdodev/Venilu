import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export function useOnboarding() {
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Runs ONCE at app start — the onboarding state can only change through the
  // wizard itself, so re-checking on every navigation was pure IPC noise.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

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

        if (cancelled) return;

        if (result.success) {
          setOnboardingCompleted(result.completed);

          if (!result.completed && location.pathname !== '/onboarding') {
            timer = setTimeout(() => {
              navigate('/onboarding', { replace: true });
            }, 300);
          }
        }
      } catch (error) {
        console.error('Error checking onboarding:', error);
        if (!cancelled) setOnboardingCompleted(false);
      }
    };

    checkOnboarding();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const completeOnboarding = () => {
    setOnboardingCompleted(true);
    navigate('/login', { replace: true });
  };

  return { onboardingCompleted, completeOnboarding };
}
