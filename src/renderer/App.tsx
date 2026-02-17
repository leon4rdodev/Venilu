import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

// Features & Shared
import { useUser } from '@renderer/features/auth';
import { AnimatedPage } from '@renderer/features/layout';
import { useOnboarding } from '@renderer/features/onboarding';

// Layout & Pages
import MainLayout from '@renderer/MainLayout';
import LoginPage from '@pages/login/page';
import DashboardPage from '@pages/dashboard/page';
import InventoryPage from '@pages/inventory/page';
import PosPage from '@pages/pos/page';
import ReportsPage from '@pages/reports/page';
import SettingsPage from '@pages/settings/page';
import OnboardingPage from '@pages/onboarding/page';

export default function App() {
  const { user, setUser } = useUser();
  const { onboardingCompleted, completeOnboarding } = useOnboarding();
  const location = useLocation();

  // Show loading while checking onboarding status
  if (onboardingCompleted === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public Routes */}
        <Route 
          path="/onboarding" 
          element={<OnboardingPage onComplete={completeOnboarding} />} 
        />
        
        <Route
          path="/login"
          element={
            onboardingCompleted ? (
              <LoginPage onLogin={setUser} />
            ) : (
              <Navigate to="/onboarding" />
            )
          }
        />

        {/* Protected Routes */}
        <Route element={user ? <MainLayout /> : <Navigate to="/login" />}>
          <Route path="dashboard" element={<AnimatedPage><DashboardPage /></AnimatedPage>} />
          <Route path="inventory" element={<AnimatedPage><InventoryPage /></AnimatedPage>} />
          <Route path="pos" element={<AnimatedPage><PosPage /></AnimatedPage>} />
          <Route path="reports" element={<AnimatedPage><ReportsPage /></AnimatedPage>} />
          <Route path="settings" element={<AnimatedPage><SettingsPage /></AnimatedPage>} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Route>

        {/* Redirects */}
        <Route
          path="*"
          element={<Navigate to={onboardingCompleted ? "/login" : "/onboarding"} />}
        />
      </Routes>
    </AnimatePresence>
  );
}