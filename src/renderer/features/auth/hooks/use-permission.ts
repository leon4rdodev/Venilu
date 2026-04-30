import { useCallback } from 'react';
import { useUser } from '@renderer/features/auth/hooks/use-user';

/**
 * Returns whether the current user has a specific granular permission.
 *
 * Legacy admins (role='admin' with empty permissions array) always return true —
 * mirrors the main process behavior for backward compatibility.
 *
 * @example
 *   const canEditPrice = usePermission('inventory:edit_price');
 *   {canEditPrice && <PriceField />}
 */
export function usePermission(permission: string): boolean {
  const { user } = useUser();
  if (!user) return false;
  // Legacy admin without RBAC role → full access
  if (user.role === 'admin' && (!user.permissions || user.permissions.length === 0)) return true;
  return user.permissions?.includes(permission) ?? false;
}

/**
 * Returns a record of permission → boolean for multiple permissions at once.
 * More efficient than calling usePermission() in a loop.
 *
 * @example
 *   const perms = usePermissions('inventory:view', 'inventory:edit', 'inventory:view_costs');
 *   {perms['inventory:view_costs'] && <CostColumn />}
 */
export function usePermissions<T extends string>(...permissions: T[]): Record<T, boolean> {
  const { user } = useUser();

  const isLegacyAdmin =
    !!user && user.role === 'admin' && (!user.permissions || user.permissions.length === 0);

  return permissions.reduce(
    (acc, perm) => {
      acc[perm] = isLegacyAdmin || (user?.permissions?.includes(perm) ?? false);
      return acc;
    },
    {} as Record<T, boolean>,
  );
}

/**
 * Returns a stable callback that checks a permission imperatively.
 * Useful inside event handlers where hooks can't be called conditionally.
 *
 * @example
 *   const can = usePermissionCheck();
 *   onClick={() => { if (can('inventory:delete')) deleteProduct(id); }}
 */
export function usePermissionCheck(): (permission: string) => boolean {
  const { user } = useUser();
  return useCallback(
    (permission: string) => {
      if (!user) return false;
      if (user.role === 'admin' && (!user.permissions || user.permissions.length === 0)) return true;
      return user.permissions?.includes(permission) ?? false;
    },
    [user],
  );
}
