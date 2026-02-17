import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import MainLayout from './MainLayout';
import LoginPage from './pages/login/page';
import DashboardPage from './pages/dashboard/page';
import InventoryPage from './pages/inventory/page';
import PosPage from './pages/pos/page';
import ReportsPage from './pages/reports/page';
import SettingsPage from './pages/settings/page';
import OnboardingPage from './pages/onboarding/page';
import { UserProvider, useUser } from './hooks/use-user';
import { ShiftProvider } from './hooks/use-shift';
import { AnimatePresence, motion } from 'framer-motion';
import { AnimatedPage } from './components/layout/animated-page';
import { Toaster } from 'sonner';
import { useTheme } from './hooks/use-theme';

function App() {
  return (
    <UserProvider>
      <ShiftProvider>
        <AppContent />
        <ToasterWithTheme />
      </ShiftProvider>
    </UserProvider>
  );
}

function ToasterWithTheme() {
  const { theme } = useTheme();
  return <Toaster position="top-center" richColors theme={theme === 'dark' ? 'dark' : 'light'} />;
}

function AppContent() {
  const { user, setUser } = useUser();
  const location = useLocation();
  const navigate = useNavigate();
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

  // Check onboarding status on initial app load
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
  }, []); // Only run once on mount

  const handleOnboardingComplete = () => {
    setOnboardingCompleted(true);
    navigate('/login', { replace: true });
  };

  const handleLogin = (data: { id: number; role: string; name: string; username: string }) => {
    setUser(data);
  };

  const ProtectedRoutes = () => (
    user ? <MainLayout /> : <Navigate to="/login" />
  );

  // Show loading while checking onboarding status
  if (onboardingCompleted === null) {
    return (
      <motion.div
        className="min-h-screen flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando...</p>
        </div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/onboarding" element={<OnboardingPage onComplete={handleOnboardingComplete} />} />
        <Route
          path="/login"
          element={
            onboardingCompleted ? (
              <LoginPage onLogin={handleLogin} />
            ) : (
              <Navigate to="/onboarding" />
            )
          }
        />
        <Route element={<ProtectedRoutes />}>
          <Route path="dashboard" element={<AnimatedPage><DashboardPage /></AnimatedPage>} />
          <Route path="inventory" element={<AnimatedPage><InventoryPage /></AnimatedPage>} />
          <Route path="pos" element={<AnimatedPage><PosPage /></AnimatedPage>} />
          <Route path="reports" element={<AnimatedPage><ReportsPage /></AnimatedPage>} />
          <Route path="settings" element={<AnimatedPage><SettingsPage /></AnimatedPage>} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Route>
        <Route
          path="*"
          element={
            <Navigate to={onboardingCompleted ? "/login" : "/onboarding"} />
          }
        />
      </Routes>
    </AnimatePresence>
  );
}

export default App;