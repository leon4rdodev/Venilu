import React, { useMemo } from 'react';
import { cn } from '@lib/utils';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  BarChart,
  Users,
  Settings,
  FileText,
} from 'lucide-react';
import { usePermission } from '@renderer/features/auth/hooks/use-permission';

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  /** null = always visible (e.g. dashboard) */
  permission: string | null;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Inicio',         permission: null },
  { to: '/pos',       icon: ShoppingCart,    label: 'Punto de Venta', permission: 'pos:access' },
  { to: '/inventory', icon: Package,         label: 'Inventario',     permission: 'inventory:view' },
  { to: '/customers', icon: Users,           label: 'Clientes',       permission: 'customers:view' },
  { to: '/reports',   icon: BarChart,        label: 'Reportes',       permission: 'reports:view_full' },
  { to: '/ecf',       icon: FileText,        label: 'e-CF',           permission: 'ecf:view' },
  { to: '/settings',  icon: Settings,        label: 'Ajustes',        permission: 'settings:view' },
];

/**
 * Permission-aware sidebar navigation.
 * Each nav item is only shown when the current user has the required permission.
 * The sidebar itself never enforces access — that's done by PermissionGuard on the routes.
 */
export function Sidebar() {
  const { pathname } = useLocation();

  // Call usePermission for each item — hooks must always be called in the same order
  const posAccess      = usePermission('pos:access');
  const invView        = usePermission('inventory:view');
  const custView       = usePermission('customers:view');
  const rptFull        = usePermission('reports:view_full');
  const ecfView        = usePermission('ecf:view');
  const settingsView   = usePermission('settings:view');

  const permMap: Record<string, boolean> = {
    'pos:access':          posAccess,
    'inventory:view':      invView,
    'customers:view':      custView,
    'reports:view_full':   rptFull,
    'ecf:view':            ecfView,
    'settings:view':       settingsView,
  };

  const visibleItems = useMemo(
    () => NAV_ITEMS.filter((item) => item.permission === null || permMap[item.permission]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [posAccess, invView, custView, rptFull, ecfView, settingsView],
  );

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-16 border-r border-border bg-sidebar">
      <div className="flex h-full flex-col">
        <div className="flex h-16 shrink-0 items-center justify-center border-b border-border">
          <Link to="/dashboard" className="group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary group-hover:scale-105 transition-transform">
              <span className="text-lg font-black text-primary-foreground select-none">V</span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <div className="flex flex-col items-center space-y-2">
            {visibleItems.map((item) => {
              const isActive = pathname === item.to;
              return (
                <Link key={item.to} to={item.to}>
                  <div
                    className={cn(
                      'group flex h-10 w-10 items-center justify-center rounded-md transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-foreground/70 hover:bg-muted hover:text-foreground',
                    )}
                    title={item.label}
                  >
                    <item.icon className="h-5 w-5" />
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </aside>
  );
}