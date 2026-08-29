import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Toaster } from 'sonner';

// Features & Shared
import { UserProvider, useUser } from '@renderer/features/auth';
import { ShiftProvider } from '@renderer/features/pos';
import { MainLayout, AnimatedPage, useTheme } from '@renderer/features/layout';
import { useOnboarding } from '@renderer/features/onboarding';
import { ThemeProvider } from '@hooks/use-theme';
import { ErrorBoundary } from '@renderer/shared/components/error-boundary';
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

// --- Data cache ---
// Central query cache: navigating back to a screen renders the cached data
// INSTANTLY and refreshes in the background. IPC is local, so retries are off.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 0,
    },
  },
});

/**
 * Bridges the app's legacy window events to cache invalidations, so every
 * existing `dispatchEvent('x-updated')` keeps all screens fresh automatically.
 */
function CacheBridge() {
  const qc = useQueryClient();
  useEffect(() => {
    const invalidate = (keys: string[]) => () =>
      keys.forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));

    const bindings: Array<[string, () => void]> = [
      ['categories-updated', invalidate(['categories', 'products', 'inventory-stats'])],
      ['inventory-updated', invalidate(['products', 'inventory-stats', 'low-stock', 'dashboard-stats'])],
      ['customers-updated', invalidate(['customers', 'customers-list', 'customer-stats'])],
      ['currency-updated', invalidate(['settings'])],
    ];

    bindings.forEach(([event, handler]) => window.addEventListener(event, handler));
    return () => bindings.forEach(([event, handler]) => window.removeEventListener(event, handler));
  }, [qc]);
  return null;
}

// --- App Structure Components ---

function ToasterWithTheme() {
  const { theme } = useTheme();
  return (
    <Toaster
      position="top-center"
      theme={theme === 'dark' ? 'dark' : 'light'}
      gap={8}
      // Custom monochrome look — no richColors; color only on the semantic icon
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'w-[356px] flex items-start gap-3 rounded-xl border border-border bg-card text-card-foreground px-4 py-3.5 shadow-lg shadow-black/5 font-sans',
          content: 'flex-1 min-w-0',
          title: 'text-sm font-semibold tracking-tight leading-snug',
          description: 'text-xs text-muted-foreground mt-0.5 leading-relaxed',
          icon: 'shrink-0 mt-0.5 [&_svg]:h-4 [&_svg]:w-4',
          success: '[&_[data-icon]]:text-emerald-600 dark:[&_[data-icon]]:text-emerald-400',
          error: '[&_[data-icon]]:text-red-600 dark:[&_[data-icon]]:text-red-400',
          warning: '[&_[data-icon]]:text-amber-600 dark:[&_[data-icon]]:text-amber-400',
          info: '[&_[data-icon]]:text-foreground',
          loading: '[&_[data-icon]]:text-muted-foreground',
          actionButton:
            'shrink-0 h-7 px-3 rounded-full bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors',
          cancelButton:
            'shrink-0 h-7 px-3 rounded-full border border-border bg-transparent text-xs font-medium text-muted-foreground hover:text-foreground transition-colors',
          closeButton:
            'absolute -top-1.5 -left-1.5 h-5 w-5 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors',
        },
      }}
    />
  );
}

function AppRoutes() {
  const { user, setUser, sessionReady } = useUser();
  const { onboardingCompleted, completeOnboarding } = useOnboarding();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    // Just long enough for the splash to not flash — was 2000ms of dead time
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
      window.dispatchEvent(new CustomEvent('venilu-ready'));
    }, 400);
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
          {/* No key here — remounting the whole tree per navigation re-ran
              every data fetch and rebuilt MainLayout on each route change */}
          <Routes>
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
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <CurrencyProvider>
          <UserProvider>
            <ShiftProvider>
              <CacheBridge />
              <AppRoutes />
              <ToasterWithTheme />
              {/* <UpdateBanner /> */}
            </ShiftProvider>
          </UserProvider>
        </CurrencyProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

// --- Entry Point ---

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Router>
        <App />
      </Router>
    </ErrorBoundary>
  </React.StrictMode>
);
