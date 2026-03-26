import { useState, useEffect, useMemo } from "react";
import { DollarSign, ShoppingBag, TrendingUp, Package } from "lucide-react";
import { ipc } from "@lib/ipc";
import { formatCurrency } from "@lib/currency";
import { IPCResponse } from "@shared/types/ipc";
import { Product, Sale } from "@shared/types/models";

interface LowStockResponse extends IPCResponse {
  data?: Product[];
}

interface RecentSalesResponse extends IPCResponse {
  data?: Sale[];
}

interface DayStats {
  totalSales: number;
  totalTransactions: number;
  averageTicket: number;
  totalItemsSold: number;
}

interface DashboardStatsResponse {
  today: DayStats;
  yesterday: DayStats;
}

interface TopProduct {
  productName: string;
  totalSold: number;
}

interface TopProductsResponse {
  success: boolean;
  data?: TopProduct[];
}

const calculateChange = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

export function useDashboard() {
  const [todayStats, setTodayStats] = useState<DayStats | null>(null);
  const [yesterdayStats, setYesterdayStats] = useState<DayStats | null>(null);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const today = new Date();
        const startDate = new Date(today.setHours(0, 0, 0, 0));
        const endDate = new Date(today.setHours(23, 59, 59, 999));

        const [dashboardStatsData, recentSalesData, lowStockData, topProductsData] =
          await Promise.all([
            ipc.invoke("get-dashboard-stats") as Promise<DashboardStatsResponse>,
            ipc.invoke("get-recent-sales", 5) as Promise<RecentSalesResponse>,
            ipc.invoke("get-low-stock-products", 5) as Promise<LowStockResponse>,
            ipc.invoke("get-top-selling-products", { startDate, endDate, limit: 5 }) as Promise<TopProductsResponse>,
          ]);

        if (dashboardStatsData) {
          setTodayStats(dashboardStatsData.today);
          setYesterdayStats(dashboardStatsData.yesterday);
        }
        setRecentSales(recentSalesData?.success && recentSalesData.data ? recentSalesData.data : []);
        setLowStockProducts(lowStockData?.success && lowStockData.data ? lowStockData.data : []);
        setTopProducts(topProductsData?.success && topProductsData.data ? topProductsData.data : []);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const statCards = useMemo(() => {
    const stats = [
      {
        title: "Ventas de Hoy",
        value: formatCurrency(todayStats?.totalSales || 0),
        current: todayStats?.totalSales || 0,
        previous: yesterdayStats?.totalSales || 0,
        icon: DollarSign,
        description: "Ingresos totales",
      },
      {
        title: "Transacciones",
        value: todayStats?.totalTransactions || 0,
        current: todayStats?.totalTransactions || 0,
        previous: yesterdayStats?.totalTransactions || 0,
        icon: ShoppingBag,
        description: "Órdenes completadas",
      },
      {
        title: "Ticket Promedio",
        value: formatCurrency(todayStats?.averageTicket || 0),
        current: todayStats?.averageTicket || 0,
        previous: yesterdayStats?.averageTicket || 0,
        icon: TrendingUp,
        description: "Por venta",
      },
      {
        title: "Prod. Vendidos",
        value: todayStats?.totalItemsSold || 0,
        current: todayStats?.totalItemsSold || 0,
        previous: yesterdayStats?.totalItemsSold || 0,
        icon: Package,
        description: "Volumen de salida",
      },
    ];

    return stats.map((stat) => {
      const change = calculateChange(stat.current, stat.previous);
      return {
        ...stat,
        change: `${change > 0 ? "+" : ""}${change.toFixed(1)}%`,
        trend: (change > 0 ? "up" : change < 0 ? "down" : "neutral") as "up" | "down" | "neutral",
      };
    });
  }, [todayStats, yesterdayStats]);

  return { loading, statCards, topProducts, recentSales, lowStockProducts };
}
