import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Toaster } from 'sonner';

// Features & Shared
import { UserProvider, useUser } from '@renderer/features/auth';
import { ShiftProvider } from '@renderer/features/pos';
import { MainLayout, AnimatedPage, useTheme } from '@renderer/features/layout';
import { useOnboarding } from '@renderer/features/onboarding';
import { ThemeProvider } from '@hooks/use-theme';
import { CurrencyProvider } from '@renderer/shared/context/currency-context';
import { PermissionGuard } from '@renderer/shared/components/permission-guard';

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
  const { user, setUser, sessionReady } = useUser();
  const { onboardingCompleted, completeOnboarding } = useOnboarding();
  const location = useLocation();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
      window.dispatchEvent(new CustomEvent('venilu-ready'));
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // Structural readiness
  const isReadyToRender = onboardingCompleted !== null && sessionReady;
  
  // Visual readiness
  const showApp = isReadyToRender && minTimeElapsed;

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {isReadyToRender && (
        <div 
          className="min-h-screen w-full"
          style={{ 
            opacity: 1,
            visibility: showApp ? 'visible' : 'hidden' 
          }}
        >
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
              <Route path="pos" element={
                <PermissionGuard permission="pos:access">
                  <AnimatedPage><PosPage /></AnimatedPage>
                </PermissionGuard>
              } />
              <Route path="inventory" element={
                <PermissionGuard permission="inventory:view">
                  <AnimatedPage><InventoryPage /></AnimatedPage>
                </PermissionGuard>
              } />
              <Route path="customers" element={
                <PermissionGuard permission="customers:view">
                  <AnimatedPage><CustomersPage /></AnimatedPage>
                </PermissionGuard>
              } />
              <Route path="reports" element={
                <PermissionGuard permission="reports:view_full">
                  <AnimatedPage><ReportsPage /></AnimatedPage>
                </PermissionGuard>
              } />
              <Route path="settings" element={
                <PermissionGuard permission="settings:view">
                  <AnimatedPage><SettingsPage /></AnimatedPage>
                </PermissionGuard>
              } />
              <Route path="*" element={<Navigate to="/dashboard" />} />
            </Route>

            <Route
              path="*"
              element={<Navigate to={onboardingCompleted ? "/login" : "/onboarding"} />}
            />
          </Routes>
        </div>
      )}
    </div>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <CurrencyProvider>
        <UserProvider>
          <ShiftProvider>
            <AppRoutes />
            <ToasterWithTheme />
            {/* <UpdateBanner /> */}
          </ShiftProvider>
        </UserProvider>
      </CurrencyProvider>
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
