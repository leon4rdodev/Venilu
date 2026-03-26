import { useState, useEffect, useCallback, useMemo } from "react";
import { subMonths, startOfDay, endOfDay } from "date-fns";
import { useToast } from "@renderer/features/layout";

type DateRange = { from?: Date; to?: Date };

export interface SalesOverTimeData {
  period: string;
  totalSales: number;
  totalTransactions: number;
}

export interface SellingProduct {
  productName: string;
  totalSold: number;
  totalRevenue: number;
}

const calculateChange = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

export function useReports() {
  const { toast } = useToast();

  const [dateRange, setDateRange] = useState<DateRange>({
    from: subMonths(startOfDay(new Date()), 1),
    to: endOfDay(new Date()),
  });
  const [loading, setLoading] = useState(true);
  const [rawMetricsData, setRawMetricsData] = useState<any>(null);
  const [salesOverTime, setSalesOverTime] = useState<SalesOverTimeData[]>([]);
  const [interval, setIntervalType] = useState<"day" | "week" | "month">("day");
  const [topSellingProducts, setTopSellingProducts] = useState<SellingProduct[]>([]);
  const [leastSellingProducts, setLeastSellingProducts] = useState<SellingProduct[]>([]);

  const startDate = useMemo(() => dateRange.from || null, [dateRange.from]);
  const endDate = useMemo(() => dateRange.to || null, [dateRange.to]);

  const fetchReportData = useCallback(async () => {
    setLoading(true);
    try {
      const startDateISO = startDate?.toISOString();
      const endDateISO = endDate?.toISOString();

      let selectedInterval = "day";
      if (startDate && endDate) {
        const diffDays = Math.ceil(
          Math.abs(endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diffDays > 120) selectedInterval = "month";
        else if (diffDays > 31) selectedInterval = "week";
      }
      setIntervalType(selectedInterval as "day" | "week" | "month");

      const [metricsData, salesTime, topProductsResponse, leastProductsResponse] =
        await Promise.all([
          window.ipcRenderer.invoke("get-total-sales-metrics", { startDate: startDateISO, endDate: endDateISO }),
          window.ipcRenderer.invoke("get-sales-over-time", { startDate: startDateISO, endDate: endDateISO, interval: selectedInterval }),
          window.ipcRenderer.invoke("get-top-selling-products", { startDate: startDateISO, endDate: endDateISO, limit: 5 }),
          window.ipcRenderer.invoke("get-least-selling-products", { startDate: startDateISO, endDate: endDateISO, limit: 5 }),
        ]);

      setRawMetricsData(metricsData);

      if (salesTime) setSalesOverTime(salesTime as SalesOverTimeData[]);

      const topProducts = topProductsResponse as { success: boolean; data: SellingProduct[] };
      setTopSellingProducts(topProducts?.success ? topProducts.data : []);

      const leastProducts = leastProductsResponse as { success: boolean; data: SellingProduct[] };
      setLeastSellingProducts(leastProducts?.success ? leastProducts.data : []);
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

  useEffect(() => {
    const clearCacheAndFetch = async () => {
      try {
        await window.ipcRenderer.invoke("clear-reports-cache");
      } catch (error) {
        console.error("Error clearing cache:", error);
      }
      fetchReportData();
    };
    clearCacheAndFetch();
  }, [fetchReportData]);

  const salesMetrics = useMemo(() => {
    const current = rawMetricsData?.current || { totalAmount: 0, netProfit: 0, totalCost: 0, averageMargin: 0 };
    const previous = rawMetricsData?.previous || { totalAmount: 0, netProfit: 0, totalCost: 0, averageMargin: 0 };

    const calcTrend = (cur: number, prev: number) => {
      const change = calculateChange(cur, prev);
      return { change: `${change.toFixed(1)}%`, trend: (change > 0 ? "up" : change < 0 ? "down" : "neutral") as "up" | "down" | "neutral" };
    };

    const costChange = calculateChange(current.totalCost, previous.totalCost || 0);
    const costTrend = (costChange > 0 ? "down" : costChange < 0 ? "up" : "neutral") as "up" | "down" | "neutral";

    return [
      { label: "Total Ventas", value: current.totalAmount, ...calcTrend(current.totalAmount, previous.totalAmount || 0) },
      { label: "Ganancia Neta", value: current.netProfit, ...calcTrend(current.netProfit, previous.netProfit || 0) },
      { label: "Costo Total", value: current.totalCost, change: `${costChange.toFixed(1)}%`, trend: costTrend },
      { label: "Margen Promedio", value: current.averageMargin, ...calcTrend(current.averageMargin, previous.averageMargin || 0) },
    ];
  }, [rawMetricsData]);

  const handleGeneratePDF = useCallback(async () => {
    try {
      const result = (await window.ipcRenderer.invoke("generate-sales-report-pdf", {
        startDate: startDate?.toISOString(),
        endDate: endDate?.toISOString(),
        metrics: rawMetricsData,
        salesOverTime,
        topSellingProducts,
        leastSellingProducts,
      })) as { success: boolean; filePath?: string; message?: string };

      if (result.success) {
        toast({ title: "PDF Generado", description: `El reporte ha sido guardado en: ${result.filePath}` });
      } else {
        toast({ title: "Error al generar PDF", description: result.message || "No se pudo generar el reporte.", variant: "destructive" });
      }
    } catch (error: unknown) {
      console.error("Error generating PDF:", error);
      toast({ title: "Error al generar PDF", description: (error as Error).message || "Ocurrió un error inesperado.", variant: "destructive" });
    }
  }, [startDate, endDate, rawMetricsData, salesOverTime, topSellingProducts, leastSellingProducts, toast]);

  return {
    dateRange,
    setDateRange,
    loading,
    salesMetrics,
    salesOverTime,
    interval,
    topSellingProducts,
    leastSellingProducts,
    handleGeneratePDF,
  };
}
