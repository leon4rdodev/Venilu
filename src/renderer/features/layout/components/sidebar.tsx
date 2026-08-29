import React, { useMemo, useRef, useState, useLayoutEffect, useEffect } from 'react';
import { cn } from '@lib/utils';
import { Link, useLocation } from 'react-router-dom';
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
 * Vercel-style icon rail. The active indicator is a single CSS pill moved with
 * a compositor-driven `transform` transition — unlike the previous JS spring
 * (framer-motion layoutId), it stays perfectly smooth even while the incoming
 * page is busy mounting tables/charts on the main thread.
 * Permission-aware — items only show when the user has access.
 */
export function Sidebar() {
  const { pathname } = useLocation();
  const navRef = useRef<HTMLElement>(null);
  const itemRefs = useRef(new Map<string, HTMLDivElement>());
  const [pill, setPill] = useState<{ x: number; y: number } | null>(null);
  // First placement must not glide in from a stale origin
  const hasPositionedRef = useRef(false);

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

  // Position the pill under the active item BEFORE paint (no flash), and keep
  // it anchored when the rail resizes (Ajustes is pinned to the bottom).
  useLayoutEffect(() => {
    const el = itemRefs.current.get(pathname);
    if (!el) {
      setPill(null);
      hasPositionedRef.current = false;
      return;
    }
    // offsetParent is the relative <nav>, so offsetLeft/Top are rail-local
    setPill({ x: el.offsetLeft, y: el.offsetTop });
    hasPositionedRef.current = true;
  }, [pathname, visibleItems, settingsView]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      const el = itemRefs.current.get(pathname);
      if (el) setPill({ x: el.offsetLeft, y: el.offsetTop });
    });
    observer.observe(nav);
    return () => observer.disconnect();
  }, [pathname]);

  const renderItem = (item: NavItem) => {
    const isActive = pathname === item.to;
    return (
      <Link key={item.to} to={item.to}>
        <div
          ref={(el) => {
            if (el) itemRefs.current.set(item.to, el);
            else itemRefs.current.delete(item.to);
          }}
          className="relative h-10 w-10"
          title={item.label}
        >
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
      <nav ref={navRef} className="relative flex h-full flex-col items-center py-4">
        {/* Active pill — GPU-composited transform, glides between items */}
        {pill && (
          <div
            aria-hidden
            className={cn(
              'absolute left-0 top-0 h-10 w-10 rounded-md bg-primary shadow-sm will-change-transform',
              hasPositionedRef.current && 'transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
            )}
            style={{ transform: `translate(${pill.x}px, ${pill.y}px)` }}
          />
        )}

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
