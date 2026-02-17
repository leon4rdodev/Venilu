import React from 'react';
import { HashRouter as Router } from 'react-router-dom';
import { UserProvider } from '@renderer/features/auth';
import { ShiftProvider } from '@renderer/features/pos';
import { ThemeProvider, useTheme } from '@hooks/use-theme';
import { Toaster } from 'sonner';

interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <Router>
      <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
        <UserProvider>
          <ShiftProvider>
            {children}
            <ToasterWithTheme />
          </ShiftProvider>
        </UserProvider>
      </ThemeProvider>
    </Router>
  );
}

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
