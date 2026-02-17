import { useEffect, useState } from "react";
import { DollarSign, ShoppingBag, TrendingUp, Package } from "lucide-react";
import { motion } from "framer-motion";
import { formatCurrency } from "@lib/currency";
import { ipc } from "@lib/ipc";
import { MetricCard } from "./components/metric-card";
import { TopProductsChart } from "./components/top-products-chart";
import { RecentSalesWidget } from "./components/recent-sales-widget";
import { LowStockWidget } from "./components/low-stock-widget";
import { IPCResponse } from "@shared/types/ipc";
import { Product, Sale } from "@shared/types/models";


// Type definitions for IPC responses
interface LowStockResponse extends IPCResponse {
  products: Product[];
}

interface RecentSalesResponse extends IPCResponse {
  sales: Sale[];
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
  products: TopProduct[];
}

// Helper function to calculate percentage change
const calculateChange = (current: number, previous: number) => {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
};

export default function DashboardPage() {
  const [todayStats, setTodayStats] = useState<DayStats | null>(null);
  const [yesterdayStats, setYesterdayStats] = useState<DayStats | null>(null);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const today = new Date();
        const startDate = new Date(today.setHours(0, 0, 0, 0));
        const endDate = new Date(today.setHours(23, 59, 59, 999));

        const [dashboardStatsData, recentSalesData, lowStockData, topProductsData] = await Promise.all([
          ipc.invoke('get-dashboard-stats') as Promise<DashboardStatsResponse>,
          ipc.invoke('get-recent-sales', 5) as Promise<RecentSalesResponse>,
          ipc.invoke('get-low-stock-products', 5) as Promise<LowStockResponse>,
          ipc.invoke('get-top-selling-products', { startDate, endDate, limit: 5 }) as Promise<TopProductsResponse>,
        ]);

        if (dashboardStatsData) {
          setTodayStats(dashboardStatsData.today);
          setYesterdayStats(dashboardStatsData.yesterday);
        }
        if (recentSalesData?.success && recentSalesData.sales) {
          setRecentSales(recentSalesData.sales);
        } else {
          setRecentSales([]);
        }
        if (lowStockData?.success && lowStockData.products) {
          setLowStockProducts(lowStockData.products);
        } else {
          setLowStockProducts([]);
        }
        if (topProductsData?.success && topProductsData.products) {
          setTopProducts(topProductsData.products);
        } else {
          setTopProducts([]);
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const statCards = todayStats ? [
    {
      title: "Ventas de Hoy",
      value: formatCurrency(todayStats.totalSales),
      current: todayStats.totalSales,
      previous: yesterdayStats?.totalSales || 0,
      icon: DollarSign,
      description: "Ingresos totales"
    },
    {
      title: "Transacciones",
      value: todayStats.totalTransactions,
      current: todayStats.totalTransactions,
      previous: yesterdayStats?.totalTransactions || 0,
      icon: ShoppingBag,
      description: "Órdenes completadas"
    },
    {
      title: "Ticket Promedio",
      value: formatCurrency(todayStats.averageTicket),
      current: todayStats.averageTicket,
      previous: yesterdayStats?.averageTicket || 0,
      icon: TrendingUp,
      description: "Por venta"
    },
    {
      title: "Prod. Vendidos",
      value: todayStats.totalItemsSold,
      current: todayStats.totalItemsSold,
      previous: yesterdayStats?.totalItemsSold || 0,
      icon: Package,
      description: "Volumen de salida"
    },
  ].map((stat) => {
    const change = calculateChange(stat.current, stat.previous);
    const trend = change > 0 ? "up" : change < 0 ? "down" : "neutral";
    const changeText = `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
    
    return {
      ...stat,
      change: changeText,
      trend: trend as "up" | "down" | "neutral",
    };
  }) : [];




  return (
    <div className="space-y-6">
      <motion.div 
        className="flex flex-col gap-1"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Dashboard
        </h1>
        <p className="text-muted-foreground text-sm max-w-2xl text-balance">
          Resumen en tiempo real de las operaciones y métricas clave de tu negocio.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="space-y-6"
      >
        {/* Stats Grid */}
        <div
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        >
          {loading ? (
             Array.from({ length: 4 }).map((_, i) => (
               <div key={i} className="h-32 bg-muted/20 animate-pulse rounded-xl border border-muted/20" />
             ))
          ) : (
            statCards.map((stat, index) => (
              <MetricCard
                key={stat.title}
                index={index}
                {...stat}
              />
            ))
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-7 lg:grid-cols-7 h-full">
          <div className="md:col-span-4 lg:col-span-5 h-full">
              <TopProductsChart data={topProducts} />
          </div>
          
          <div className="md:col-span-3 lg:col-span-2 flex flex-col gap-6">
            <RecentSalesWidget sales={recentSales} loading={loading} />
            <LowStockWidget products={lowStockProducts} loading={loading} />
          </div>
        </div>
      </motion.div>
    </div>
  )
}

