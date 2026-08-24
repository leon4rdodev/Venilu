import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { subMonths, startOfDay, endOfDay } from "date-fns";
import { toast } from "sonner";

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

interface ReportsData {
  rawMetricsData: any;
  salesOverTime: SalesOverTimeData[];
  topSellingProducts: SellingProduct[];
  leastSellingProducts: SellingProduct[];
}

/**
 * Cached reports — keyed by date range with keepPreviousData, so changing the
 * range keeps the current report on screen while the new one loads, and
 * revisiting a range you already viewed renders instantly.
 */
export function useReports() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subMonths(startOfDay(new Date()), 1),
    to: endOfDay(new Date()),
  });

  const startDate = dateRange.from ?? null;
  const endDate = dateRange.to ?? null;
  const startISO = startDate?.toISOString() ?? null;
  const endISO = endDate?.toISOString() ?? null;

  // Chart granularity derives from the range length
  const interval = useMemo<"day" | "week" | "month">(() => {
    if (!startDate || !endDate) return "day";
    const diffDays = Math.ceil(Math.abs(endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 120) return "month";
    if (diffDays > 31) return "week";
    return "day";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startISO, endISO]);

  const query = useQuery<ReportsData>({
    queryKey: ["reports", startISO, endISO],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const [metricsData, salesTime, topProductsResponse, leastProductsResponse] =
        await Promise.all([
          window.ipcRenderer.invoke("get-total-sales-metrics", { startDate: startISO, endDate: endISO }),
          window.ipcRenderer.invoke("get-sales-over-time", { startDate: startISO, endDate: endISO, interval }),
          window.ipcRenderer.invoke("get-top-selling-products", { startDate: startISO, endDate: endISO, limit: 5 }),
          window.ipcRenderer.invoke("get-least-selling-products", { startDate: startISO, endDate: endISO, limit: 5 }),
        ]);

      const topProducts = topProductsResponse as { success: boolean; data: SellingProduct[] };
      const leastProducts = leastProductsResponse as { success: boolean; data: SellingProduct[] };

      return {
        rawMetricsData: metricsData,
        salesOverTime: Array.isArray(salesTime) ? (salesTime as SalesOverTimeData[]) : [],
        topSellingProducts: topProducts?.success ? topProducts.data : [],
        leastSellingProducts: leastProducts?.success ? leastProducts.data : [],
      };
    },
  });

  useEffect(() => {
    if (query.error) {
      toast.error("Error al cargar reportes", {
        description: query.error instanceof Error ? query.error.message : "Ocurrió un error inesperado.",
      });
    }
  }, [query.error]);

  const rawMetricsData = query.data?.rawMetricsData ?? null;
  const salesOverTime = query.data?.salesOverTime ?? [];
  const topSellingProducts = query.data?.topSellingProducts ?? [];
  const leastSellingProducts = query.data?.leastSellingProducts ?? [];

  const salesMetrics = useMemo(() => {
    const EMPTY = { totalAmount: 0, netProfit: 0, totalCost: 0, averageMargin: 0, totalSalesCount: 0, averageTicket: 0, totalItemsSold: 0 };
    const current = rawMetricsData?.current || EMPTY;
    const previous = rawMetricsData?.previous || EMPTY;

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
      { label: "Transacciones", value: current.totalSalesCount || 0, ...calcTrend(current.totalSalesCount || 0, previous.totalSalesCount || 0) },
      { label: "Ticket Promedio", value: current.averageTicket || 0, ...calcTrend(current.averageTicket || 0, previous.averageTicket || 0) },
      { label: "Unidades Vendidas", value: current.totalItemsSold || 0, ...calcTrend(current.totalItemsSold || 0, previous.totalItemsSold || 0) },
    ];
  }, [rawMetricsData]);

  const handleGeneratePDF = useCallback(async () => {
    try {
      const result = (await window.ipcRenderer.invoke("generate-sales-report-pdf", {
        startDate: startISO,
        endDate: endISO,
        metrics: rawMetricsData,
        salesOverTime,
        topSellingProducts,
        leastSellingProducts,
      })) as { success: boolean; filePath?: string; message?: string };

      if (result.success) {
        toast.success("PDF generado", { description: `El reporte ha sido guardado en: ${result.filePath}` });
      } else {
        toast.error("Error al generar PDF", { description: result.message || "No se pudo generar el reporte." });
      }
    } catch (error: unknown) {
      console.error("Error generating PDF:", error);
      toast.error("Error al generar PDF", { description: (error as Error).message || "Ocurrió un error inesperado." });
    }
  }, [startISO, endISO, rawMetricsData, salesOverTime, topSellingProducts, leastSellingProducts]);

  return {
    dateRange,
    setDateRange,
    loading: query.isPending,
    salesMetrics,
    salesOverTime,
    interval,
    topSellingProducts,
    leastSellingProducts,
    handleGeneratePDF,
  };
}
