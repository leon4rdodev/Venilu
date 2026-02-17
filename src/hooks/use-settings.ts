import { useState, useEffect } from 'react';

export interface Settings {
  id: number;
  business_name: string;
  business_address: string;
  business_phone: string;
  business_email: string;
  business_tax_id: string;
  logo_filename: string | null;
  printer_name: string | null;
  paper_size: string;
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (!window.ipcRenderer) {
        throw new Error('IPC Renderer not available');
      }

      const result = await window.ipcRenderer.invoke('settings:get') as {
        success: boolean;
        settings?: Settings;
        message?: string;
      };

      if (result.success && result.settings) {
        setSettings(result.settings);
      } else {
        setError(result.message || 'Failed to load settings');
      }
    } catch (err) {
      console.error('Error loading settings:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<Settings>) => {
    try {
      if (!window.ipcRenderer) {
        throw new Error('IPC Renderer not available');
      }

      const result = await window.ipcRenderer.invoke('settings:update', newSettings) as {
        success: boolean;
        message?: string;
      };

      if (result.success) {
        // Reload settings to get updated data
        await loadSettings();
        return { success: true };
      } else {
        return { success: false, message: result.message };
      }
    } catch (err) {
      console.error('Error updating settings:', err);
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Unknown error'
      };
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  return {
    settings,
    isLoading,
    error,
    updateSettings,
    refreshSettings: loadSettings
  };
}
