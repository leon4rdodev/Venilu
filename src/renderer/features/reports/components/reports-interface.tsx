import { useEffect, useState, useCallback, useMemo } from "react";
import { subMonths, startOfDay, endOfDay } from "date-fns";
import { useSidebar, useToast } from "@renderer/features/layout";
import { ReportsHeader } from "./reports-header";
import { SalesMetricsGrid } from "./sales-metrics-grid";
import { SalesOverTimeChart } from "./sales-over-time-chart";
import { TopSellingProductsTable } from "./top-selling-products-table";
import { LeastSellingProductsTable } from "./least-selling-products-table";
import { motion, AnimatePresence } from "framer-motion";

type DateRange = { from?: Date; to?: Date };

interface SalesOverTimeData {
  period: string;
  totalSales: number;
  totalTransactions: number;
}

interface TopSellingProduct {
  productName: string;
  totalSold: number;
  totalRevenue: number;
}

interface LeastSellingProduct {
  productName: string;
  totalSold: number;
  totalRevenue: number;
}

// Helper function to calculate percentage change
const calculateChange = (current: number, previous: number) => {
  if (previous === 0) {
    return current > 0 ? 100 : 0; // If previous is 0 and current is > 0, it's a 100% increase
  }
  return ((current - previous) / previous) * 100;
};

export function ReportsInterface() {
  const { toast } = useToast();
  const { isToggling: isSidebarToggling } = useSidebar();

  const [dateRange, setDateRange] = useState<DateRange>({
    from: subMonths(startOfDay(new Date()), 1),
    to: endOfDay(new Date()),
  });

  const [loading, setLoading] = useState(true);

  const [rawMetricsData, setRawMetricsData] = useState<any>(null);
  const [salesOverTime, setSalesOverTime] = useState<SalesOverTimeData[]>([]);
  const [interval, setInterval] = useState<'day' | 'week' | 'month'>('day');
  const [topSellingProducts, setTopSellingProducts] = useState<TopSellingProduct[]>([]);
  const [leastSellingProducts, setLeastSellingProducts] = useState<LeastSellingProduct[]>([]);

  const startDate = useMemo(() => dateRange.from || null, [dateRange.from]);
  const endDate = useMemo(() => dateRange.to || null, [dateRange.to]);

  const fetchReportData = useCallback(async () => {
    setLoading(true);

    try {
      const startDateISO = startDate?.toISOString();
      const endDateISO = endDate?.toISOString();

      // Determine interval based on duration
      let selectedInterval = 'day';
      if (startDate && endDate) {
        const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 120) selectedInterval = 'month';
        else if (diffDays > 31) selectedInterval = 'week';
      }
      setInterval(selectedInterval as 'day' | 'week' | 'month');

      // Fetch all data in parallel
      const [
        metricsData,
        salesTime,
        topProductsResponse,
        leastProductsResponse
      ] = await Promise.all([
        window.ipcRenderer.invoke("get-total-sales-metrics", { startDate, endDate }),
        window.ipcRenderer.invoke("get-sales-over-time", { startDate: startDateISO, endDate: endDateISO, interval: selectedInterval }),
        window.ipcRenderer.invoke("get-top-selling-products", { startDate: startDateISO, endDate: endDateISO, limit: 5 }),
        window.ipcRenderer.invoke("get-least-selling-products", { startDate: startDateISO, endDate: endDateISO, limit: 5 })
      ]);

      setRawMetricsData(metricsData);

      if (salesTime) {
        setSalesOverTime(salesTime as SalesOverTimeData[]);
      }

      const topProducts = topProductsResponse as { success: boolean; products: TopSellingProduct[] };
      if (topProducts?.success && topProducts.products) {
        setTopSellingProducts(topProducts.products);
      } else {
        setTopSellingProducts([]);
      }

      const leastProducts = leastProductsResponse as { success: boolean; products: LeastSellingProduct[] };
      if (leastProducts?.success && leastProducts.products) {
        setLeastSellingProducts(leastProducts.products);
      } else {
        setLeastSellingProducts([]);
      }
    } catch (error: unknown) {
      console.error("Error fetching report data:", error);
      toast({
        title: "Error al cargar reportes",
        description: (error as Error).message || "Ocurrió un error inesperado.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, toast]);

  // Clear cache and fetch data when component mounts or date range changes
  useEffect(() => {
    const clearCacheAndFetch = async () => {
      try {
        await window.ipcRenderer.invoke('clear-reports-cache');
      } catch (error) {
        console.error('Error clearing cache:', error);
      }
      fetchReportData();
    };

    clearCacheAndFetch();
  }, [fetchReportData]);

  const salesMetrics = useMemo(() => {
    if (!rawMetricsData || !rawMetricsData.current) return [];

    const current = rawMetricsData.current;
    const previous = rawMetricsData.previous || {};

    const calculateMetricTrend = (currentValue: number, previousValue: number) => {
      const change = calculateChange(currentValue, previousValue);
      const trend: 'up' | 'down' | 'neutral' = change > 0 ? 'up' : (change < 0 ? 'down' : 'neutral');
      return { change: `${change.toFixed(1)}%`, trend };
    };

    return [
      {
        label: "Total Ventas",
        value: current.totalAmount,
        ...calculateMetricTrend(current.totalAmount, previous.totalAmount || 0),
      },
      {
        label: "Ganancia Neta",
        value: current.netProfit,
        ...calculateMetricTrend(current.netProfit, previous.netProfit || 0),
      },
      {
        label: "Costo Total",
        value: current.totalCost,
        ...(() => {
          const { change, trend } = calculateMetricTrend(current.totalCost, previous.totalCost || 0);
          // Invert trend for costs: higher cost = bad (down), lower cost = good (up)
          const invertedTrend: 'up' | 'down' | 'neutral' = trend === 'up' ? 'down' : trend === 'down' ? 'up' : 'neutral';
          return { change, trend: invertedTrend };
        })(),
      },
      {
        label: "Margen Promedio",
        value: current.averageMargin,
        ...calculateMetricTrend(current.averageMargin, previous.averageMargin || 0),
      },
    ];
  }, [rawMetricsData]);

  const handleGeneratePDF = useCallback(async () => {
    try {
      const result = await window.ipcRenderer.invoke('generate-sales-report-pdf', {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        metrics: rawMetricsData,
        salesOverTime,
        topSellingProducts,
        leastSellingProducts,
      }) as { success: boolean; filePath?: string; message?: string };

      if (result.success) {
        toast({
          title: "PDF Generado",
          description: `El reporte ha sido guardado en: ${result.filePath}`,
        });
      } else {
        toast({
          title: "Error al generar PDF",
          description: result.message || "No se pudo generar el reporte.",
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Error al generar PDF",
        description: (error as Error).message || "Ocurrió un error inesperado.",
        variant: "destructive",
      });
    }
  }, [startDate, endDate, rawMetricsData, salesOverTime, topSellingProducts, leastSellingProducts, toast]);

  // Key that changes on each date selection to trigger re-animation
  const contentKey = useMemo(
    () => `${loading ? 'loading' : 'loaded'}-${startDate?.getTime()}-${endDate?.getTime()}`,
    [loading, startDate, endDate]
  );

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <ReportsHeader onDateRangeChange={setDateRange} onGeneratePDF={handleGeneratePDF} />
      </motion.div>

      <AnimatePresence mode="wait">
        <motion.div
          key={contentKey}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
          className="space-y-6"
        >
          {/* Sales Metrics */}
          <SalesMetricsGrid salesMetrics={salesMetrics} loading={loading} />

          {/* Sales Over Time Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            {isSidebarToggling ? (
              <div className="h-64 flex items-center justify-center">
                <p className="text-muted-foreground">Cargando gráfico...</p>
              </div>
            ) : (
              <SalesOverTimeChart salesOverTime={salesOverTime} loading={loading} interval={interval} />
            )}
          </motion.div>

          {/* Products Tables */}
          <div className="grid gap-6 md:grid-cols-2">
            <TopSellingProductsTable
              topSellingProducts={topSellingProducts}
              loading={loading}
            />
            <LeastSellingProductsTable
              leastSellingProducts={leastSellingProducts}
              loading={loading}
            />
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
