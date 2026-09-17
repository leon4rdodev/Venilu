import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ipc } from '@lib/ipc';

// Mirror of the main-process LicenseStatus contract (license:status / license:activate).
export type LicenseState = 'trial' | 'active' | 'expired' | 'trial_expired' | 'clock_rollback';

export interface LicenseInfo {
  id: string;
  customer: string;
  business?: string;
  type: 'perpetua' | 'anual';
  /** YYYY-MM-DD */
  issued: string;
  /** YYYY-MM-DD — only for annual licenses */
  expires?: string;
}

export interface LicenseStatus {
  state: LicenseState;
  blocked: boolean;
  license?: LicenseInfo;
  trialDaysLeft?: number;
  daysToExpiry?: number;
}

export interface ActivateResult {
  success: boolean;
  status?: LicenseStatus;
  message?: string;
}

/**
 * License status of this installation. The UI gate is a courtesy — the main
 * process also blocks `process-sale` when the license is expired — so on any
 * ambiguous answer (error, `data: null`) we resolve to "no verdict" (null)
 * and never lock the user out by mistake.
 */
export function useLicense() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['license-status'],
    staleTime: 60_000,
    queryFn: async (): Promise<LicenseStatus | null> => {
      const res = (await ipc.invoke('license:status')) as {
        success: boolean;
        data?: LicenseStatus | null;
      };
      return res?.success && res.data ? res.data : null;
    },
  });

  const activate = useCallback(
    async (key: string): Promise<ActivateResult> => {
      try {
        const res = (await ipc.invoke('license:activate', { key })) as {
          success: boolean;
          data?: LicenseStatus;
          message?: string;
        };
        if (res?.success && res.data) {
          // Feed the fresh status straight into the cache so the gate
          // re-renders immediately, then revalidate in the background.
          queryClient.setQueryData(['license-status'], res.data);
          void queryClient.invalidateQueries({ queryKey: ['license-status'] });
          return { success: true, status: res.data };
        }
        return { success: false, message: res?.message || 'No se pudo activar la licencia.' };
      } catch {
        return { success: false, message: 'Ocurrió un error al activar la licencia.' };
      }
    },
    [queryClient]
  );

  return {
    status: query.data ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
    activate,
  };
}
