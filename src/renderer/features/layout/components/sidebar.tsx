import React, { useMemo } from 'react';
import { cn } from '@lib/utils';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  BarChart,
  Users,
  Settings,
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
];

const SETTINGS_ITEM: NavItem = {
  to: '/settings', icon: Settings, label: 'Ajustes', permission: 'settings:view',
};

/**
 * Vercel-style icon rail. The active indicator is a shared-layout motion pill
 * that GLIDES between items with a spring — no teleporting/jumping.
 * Permission-aware — items only show when the user has access.
 */
export function Sidebar() {
  const { pathname } = useLocation();

  // Call usePermission for each item — hooks must always be called in the same order
  const posAccess      = usePermission('pos:access');
  const invView        = usePermission('inventory:view');
  const custView       = usePermission('customers:view');
  const rptFull        = usePermission('reports:view_full');
  const settingsView   = usePermission('settings:view');

  const permMap: Record<string, boolean> = {
    'pos:access':          posAccess,
    'inventory:view':      invView,
    'customers:view':      custView,
    'reports:view_full':   rptFull,
    'settings:view':       settingsView,
  };

  const visibleItems = useMemo(
    () => NAV_ITEMS.filter((item) => item.permission === null || permMap[item.permission]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [posAccess, invView, custView, rptFull],
  );

  const renderItem = (item: NavItem) => {
    const isActive = pathname === item.to;
    return (
      <Link key={item.to} to={item.to}>
        <div className="relative h-10 w-10" title={item.label}>
          {isActive && (
            <motion.div
              layoutId="sidebar-active-pill"
              className="absolute inset-0 rounded-md bg-primary shadow-sm"
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
            />
          )}
          <div
            className={cn(
              'relative z-10 flex h-10 w-10 items-center justify-center rounded-md transition-colors duration-200',
              isActive
                ? 'text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <item.icon className="h-5 w-5" strokeWidth={1.75} />
          </div>
        </div>
      </Link>
    );
  };

  return (
    <aside className="fixed left-0 top-16 bottom-0 z-30 w-16 border-r border-border bg-background">
      <nav className="flex h-full flex-col items-center py-4">
        <div className="flex flex-col items-center gap-2">
          {visibleItems.map(renderItem)}
        </div>
        <div className="flex-1" />
        {settingsView && (
          <div className="flex flex-col items-center pb-1">
            {renderItem(SETTINGS_ITEM)}
          </div>
        )}
      </nav>
    </aside>
  );
}
