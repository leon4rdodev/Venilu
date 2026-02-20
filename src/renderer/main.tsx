import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'sonner';

// Features & Shared
import { UserProvider, useUser } from '@renderer/features/auth';
import { ShiftProvider } from '@renderer/features/pos';
import { MainLayout, AnimatedPage, useTheme } from '@renderer/features/layout';
import { useOnboarding } from '@renderer/features/onboarding';
import { ThemeProvider } from '@hooks/use-theme';

// Pages
import LoginPage from '@pages/login/page';
import DashboardPage from '@pages/dashboard/page';
import InventoryPage from '@pages/inventory/page';
import PosPage from '@pages/pos/page';
import ReportsPage from '@pages/reports/page';
import CustomersPage from '@pages/customers/page';
import SettingsPage from '@pages/settings/page';
import OnboardingPage from '@pages/onboarding/page';

import './index.css';

// --- App Structure Components ---

function ToasterWithTheme() {
  const { theme } = useTheme();
  return (
    <Toaster 
      position="top-center" 
      richColors 
      theme={theme === 'dark' ? 'dark' : 'light'} 
    />
  );
}

function AppRoutes() {
  const { user, setUser } = useUser();
  const { onboardingCompleted, completeOnboarding } = useOnboarding();
  const location = useLocation();

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

        <Route element={user ? <MainLayout /> : <Navigate to="/login" />}>
          <Route path="dashboard" element={<AnimatedPage><DashboardPage /></AnimatedPage>} />
          <Route path="inventory" element={<AnimatedPage><InventoryPage /></AnimatedPage>} />
          <Route path="pos" element={<AnimatedPage><PosPage /></AnimatedPage>} />
          <Route path="reports" element={<AnimatedPage><ReportsPage /></AnimatedPage>} />
          <Route path="customers" element={<AnimatedPage><CustomersPage /></AnimatedPage>} />
          <Route path="settings" element={<AnimatedPage><SettingsPage /></AnimatedPage>} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Route>

        <Route
          path="*"
          element={<Navigate to={onboardingCompleted ? "/login" : "/onboarding"} />}
        />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <UserProvider>
        <ShiftProvider>
          <AppRoutes />
          <ToasterWithTheme />
        </ShiftProvider>
      </UserProvider>
    </ThemeProvider>
  );
}

// --- Entry Point ---

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <Router>
      <App />
    </Router>
  </React.StrictMode>
);
