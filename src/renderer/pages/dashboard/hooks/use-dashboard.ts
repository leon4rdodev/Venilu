import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DollarSign, ShoppingBag, TrendingUp, Package, Percent, Layers, AlertTriangle } from 'lucide-react';
import { ipc } from '@lib/ipc';
import { formatCurrency } from '@lib/currency';
import { Product, Sale } from '@shared/types/models';
import { usePermissions } from '@renderer/features/auth/hooks/use-permission';
import { useUser } from '@renderer/features/auth';
import type { MetricCardProps } from '@renderer/pages/dashboard/components/metric-card';
import type {
  DashboardStatsResponse,
  ShiftSummaryResponse,
  LowStockResponse,
  RecentSalesResponse,
  HourlySalesResponse,
  PaymentMethodsResponse,
  InventoryStatsData,
  InventoryStatsResponse,
} from '@renderer/features/dashboard/types';

const calculateChange = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

const trendOf = (current: number, previous: number) => {
  const change = calculateChange(current, previous);
  return {
    change: `${change > 0 ? '+' : ''}${change.toFixed(1)}%`,
    trend: (change > 0 ? 'up' : change < 0 ? 'down' : 'neutral') as 'up' | 'down' | 'neutral',
  };
};

/**
 * Dashboard data via the shared query cache: navigating away and back renders
 * the cached dashboard INSTANTLY while everything refreshes in the background.
 */
export function useDashboard() {
  const { user } = useUser();

  const perms = usePermissions('reports:view_summary', 'sales:view', 'inventory:view');
  const canViewSummary = perms['reports:view_summary'];
  const canViewSales   = perms['sales:view'];
  const canViewStock   = perms['inventory:view'];

  const [hourlyDay, setHourlyDay] = useState<'today' | 'yesterday'>('today');

  const shiftQuery = useQuery({
    queryKey: ['shift-summary'],
    enabled: !!user,
    queryFn: async () => {
      const res = await ipc.invoke('get-shift-summary') as ShiftSummaryResponse;
      return res?.success ? res.data ?? null : null;
    },
  });

  const statsQuery = useQuery({
    queryKey: ['dashboard-stats'],
    enabled: !!user && canViewSummary,
    queryFn: async () => await ipc.invoke('get-dashboard-stats') as DashboardStatsResponse,
  });

  const recentSalesQuery = useQuery({
    queryKey: ['recent-sales'],
    enabled: !!user && canViewSales,
    queryFn: async () => {
      const res = await ipc.invoke('get-recent-sales', 6) as RecentSalesResponse;
      return res?.success && res.data ? res.data : [];
    },
  });

  const lowStockQuery = useQuery({
    queryKey: ['low-stock'],
    enabled: !!user && canViewStock,
    queryFn: async () => {
      const res = await ipc.invoke('get-low-stock-products', 5) as LowStockResponse;
      return res?.success && res.data ? res.data : [];
    },
  });

  // Same cache key as the inventory screen's stats — one fetch serves both
  const inventoryStatsQuery = useQuery({
    queryKey: ['inventory-stats'],
    enabled: !!user && canViewStock,
    queryFn: async () => {
      const res = await ipc.invoke('get-inventory-stats') as InventoryStatsResponse;
      if (!res?.success || !res.data) throw new Error(res?.message || 'Error');
      return res.data;
    },
  });

  const paymentsQuery = useQuery({
    queryKey: ['payment-methods'],
    enabled: !!user && canViewSummary,
    queryFn: async () => {
      const res = await ipc.invoke('get-payment-method-totals') as PaymentMethodsResponse;
      return res?.success && res.data ? res.data : [];
    },
  });

  const hourlyQuery = useQuery({
    queryKey: ['sales-by-hour', hourlyDay],
    enabled: !!user && canViewSummary,
    queryFn: async () => {
      const res = await ipc.invoke('get-sales-by-hour', { day: hourlyDay }) as HourlySalesResponse;
      return res?.success && res.data ? res.data : [];
    },
  });

  const todayStats = statsQuery.data?.today ?? null;
  const yesterdayStats = statsQuery.data?.yesterday ?? null;
  const inventoryStats: InventoryStatsData | null = inventoryStatsQuery.data ?? null;

  const loading =
    (canViewSummary && statsQuery.isPending) ||
    (canViewSales && recentSalesQuery.isPending) ||
    (canViewStock && (lowStockQuery.isPending || inventoryStatsQuery.isPending)) ||
    (canViewSummary && paymentsQuery.isPending);

  const statCards = useMemo<(Omit<MetricCardProps, 'index'>)[]>(() => {
    const cards: (Omit<MetricCardProps, 'index'>)[] = [];

    if (todayStats) {
      cards.push(
        {
          title: 'Ventas de Hoy',
          value: formatCurrency(todayStats.totalSales),
          icon: DollarSign,
          ...trendOf(todayStats.totalSales, yesterdayStats?.totalSales ?? 0),
        },
        {
          title: 'Transacciones',
          value: todayStats.totalTransactions,
          icon: ShoppingBag,
        },
        {
          title: 'Ticket Promedio',
          value: formatCurrency(todayStats.averageTicket),
          icon: TrendingUp,
        },
        {
          title: 'Prod. Vendidos',
          value: todayStats.totalItemsSold,
          icon: Package,
        },
        {
          title: 'Margen Utilidad',
          value: `${todayStats.averageMargin.toFixed(1)}%`,
          icon: Percent,
          ...trendOf(todayStats.averageMargin, yesterdayStats?.averageMargin ?? 0),
        },
      );
    }

    if (inventoryStats) {
      const alerts = inventoryStats.lowStockProducts + inventoryStats.outOfStockProducts;
      cards.push(
        {
          title: 'Stock Total',
          value: inventoryStats.totalStockUnits.toLocaleString('es-DO'),
          icon: Layers,
        },
        {
          title: 'Alertas Stock',
          value: alerts,
          icon: AlertTriangle,
          // Red only when there is something to act on — zero alerts is a healthy state
          variant: alerts > 0 ? 'danger' : 'default',
        },
      );
    }

    return cards;
  }, [todayStats, yesterdayStats, inventoryStats]);

  return {
    loading,
    shiftSummary: shiftQuery.data ?? null,
    statCards,
    hourlySales: hourlyQuery.data ?? [],
    hourlyLoading: canViewSummary && hourlyQuery.isPending,
    hourlyDay,
    setHourlyDay,
    paymentTotals: paymentsQuery.data ?? [],
    recentSales: (canViewSales ? recentSalesQuery.data ?? [] : []) as Sale[],
    lowStockProducts: (canViewStock ? lowStockQuery.data ?? [] : []) as Product[],
    canViewSummary,
    canViewSales,
    canViewStock,
  };
}
