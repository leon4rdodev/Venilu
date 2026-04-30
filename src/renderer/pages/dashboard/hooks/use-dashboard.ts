import { useState, useEffect, useMemo } from 'react';
import { DollarSign, ShoppingBag, TrendingUp, Package } from 'lucide-react';
import { ipc } from '@lib/ipc';
import { formatCurrency } from '@lib/currency';
import { Product, Sale } from '@shared/types/models';
import { usePermissions } from '@renderer/features/auth/hooks/use-permission';
import { useUser } from '@renderer/features/auth';
import type {
  DayStats,
  DashboardStatsResponse,
  TopProduct,
  TopProductsResponse,
  ShiftSummary,
  ShiftSummaryResponse,
  LowStockResponse,
  RecentSalesResponse,
} from '@renderer/features/dashboard/types';


const calculateChange = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

export function useDashboard() {
  const { user } = useUser();

  // Batch permission check — single hook call, stable object
  const perms = usePermissions(
    'reports:view_summary',
    'sales:view',
    'inventory:view',
  );
  const canViewSummary = perms['reports:view_summary'];
  const canViewSales   = perms['sales:view'];
  const canViewStock   = perms['inventory:view'];

  const [shiftSummary, setShiftSummary]         = useState<ShiftSummary | null>(null);
  const [todayStats, setTodayStats]             = useState<DayStats | null>(null);
  const [yesterdayStats, setYesterdayStats]     = useState<DayStats | null>(null);
  const [recentSales, setRecentSales]           = useState<Sale[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [topProducts, setTopProducts]           = useState<TopProduct[]>([]);
  const [loading, setLoading]                   = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Always fetch: own shift summary (pos:access level)
        const shiftRes = await ipc.invoke('get-shift-summary') as ShiftSummaryResponse;
        if (shiftRes?.success) setShiftSummary(shiftRes.data ?? null);

        // Conditional fetches based on permissions
        const today = new Date();
        const startDate = new Date(today.setHours(0, 0, 0, 0));
        const endDate   = new Date(today.setHours(23, 59, 59, 999));

        const [statsData, salesData, stockData, topData] = await Promise.all([
          canViewSummary
            ? ipc.invoke('get-dashboard-stats') as Promise<DashboardStatsResponse>
            : Promise.resolve(null),
          canViewSales
            ? ipc.invoke('get-recent-sales', 5) as Promise<RecentSalesResponse>
            : Promise.resolve(null),
          canViewStock
            ? ipc.invoke('get-low-stock-products', 5) as Promise<LowStockResponse>
            : Promise.resolve(null),
          canViewSummary
            ? ipc.invoke('get-top-selling-products', { startDate, endDate, limit: 5 }) as Promise<TopProductsResponse>
            : Promise.resolve(null),
        ]);

        if (statsData) {
          setTodayStats(statsData.today);
          setYesterdayStats(statsData.yesterday);
        }
        setRecentSales(salesData?.success && salesData.data ? salesData.data : []);
        setLowStockProducts(stockData?.success && stockData.data ? stockData.data : []);
        setTopProducts(topData?.success && topData.data ? topData.data : []);
      } catch (err) {
        console.error('[useDashboard] Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, canViewSummary, canViewSales, canViewStock]);

  const statCards = useMemo(() => {
    if (!todayStats) return [];
    return [
      { title: 'Ventas de Hoy',   value: formatCurrency(todayStats.totalSales),    current: todayStats.totalSales,        previous: yesterdayStats?.totalSales ?? 0,        icon: DollarSign,  description: 'Ingresos totales' },
      { title: 'Transacciones',   value: todayStats.totalTransactions,              current: todayStats.totalTransactions, previous: yesterdayStats?.totalTransactions ?? 0, icon: ShoppingBag, description: 'Órdenes completadas' },
      { title: 'Ticket Promedio', value: formatCurrency(todayStats.averageTicket),  current: todayStats.averageTicket,     previous: yesterdayStats?.averageTicket ?? 0,     icon: TrendingUp,  description: 'Por venta' },
      { title: 'Prod. Vendidos',  value: todayStats.totalItemsSold,                 current: todayStats.totalItemsSold,    previous: yesterdayStats?.totalItemsSold ?? 0,    icon: Package,     description: 'Volumen de salida' },
    ].map((stat) => {
      const change = calculateChange(stat.current, stat.previous);
      return { ...stat, change: `${change > 0 ? '+' : ''}${change.toFixed(1)}%`, trend: (change > 0 ? 'up' : change < 0 ? 'down' : 'neutral') as 'up' | 'down' | 'neutral' };
    });
  }, [todayStats, yesterdayStats]);

  return {
    loading,
    // Shift summary — always available
    shiftSummary,
    // Permission-gated data
    statCards:         canViewSummary ? statCards : [],
    topProducts:       canViewSummary ? topProducts : [],
    recentSales:       canViewSales   ? recentSales : [],
    lowStockProducts:  canViewStock   ? lowStockProducts : [],
    // Permission flags for the component to conditionally render widgets
    canViewSummary,
    canViewSales,
    canViewStock,
  };
}
