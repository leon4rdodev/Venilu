import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermission } from '@renderer/features/auth/hooks/use-permission';

interface PermissionGuardProps {
  /** The permission required to render children */
  permission: string;
  /** Content to render when the user has the required permission */
  children: ReactNode;
  /**
   * What to render when the permission is absent.
   * Defaults to <Navigate to="/dashboard" replace /> — silent redirect.
   */
  fallback?: ReactNode;
}

/**
 * Declarative permission gate for React routes and UI sections.
 *
 * Route-level usage:
 * ```tsx
 * <Route path="reports" element={
 *   <PermissionGuard permission="reports:view_full">
 *     <AnimatedPage><ReportsPage /></AnimatedPage>
 *   </PermissionGuard>
 * } />
 * ```
 *
 * Component-level usage:
 * ```tsx
 * <PermissionGuard permission="inventory:delete" fallback={null}>
 *   <DeleteButton />
 * </PermissionGuard>
 * ```
 *
 * Note: this is a UX safeguard. Real enforcement is in the IPC handlers
 * via requirePermission() in the main process.
 */
export function PermissionGuard({ permission, children, fallback }: PermissionGuardProps) {
  const hasPermission = usePermission(permission);

  if (!hasPermission) {
    return <>{fallback ?? <Navigate to="/dashboard" replace />}</>;
  }

  return <>{children}</>;
}
