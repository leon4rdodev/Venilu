import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { subDays, startOfDay, endOfDay } from "date-fns";
import { toast } from "sonner";
import type { DateRange } from "react-day-picker";

export interface SalesOverTimeData {
  period: string;
  totalSales: number;
  totalTransactions: number;
  totalProfit: number;
}

export interface SellingProduct {
  productName: string;
  totalSold: number;
  totalRevenue: number;
  totalProfit: number;
  margin: number;
}

export type PaymentMethod = "cash" | "card" | "transfer" | "credit";

export interface PaymentBreakdownItem {
  method: PaymentMethod;
  /** Dinero recibido por el método (para 'credit': saldo pendiente de cobro). */
  total: number;
  /** Ventas cobradas con el método (para 'credit': ventas fiadas). */
  transactions: number;
  /** Abonos a deuda recibidos por el método (no son ventas). */
  debtPayments?: number;
}

export interface CategoryBreakdownItem {
  categoryName: string;
  totalSold: number;
  totalRevenue: number;
  totalProfit: number;
  margin: number;
}

export interface TopCustomer {
  customerId: number;
  customerName: string;
  totalSpent: number;
  totalTransactions: number;
  averageTicket: number;
}

export type ExportKind = "pdf" | "csv";

const calculateChange = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

interface ReportsData {
  rawMetricsData: any;
  salesOverTime: SalesOverTimeData[];
  topSellingProducts: SellingProduct[];
  leastSellingProducts: SellingProduct[];
  paymentBreakdown: PaymentBreakdownItem[];
  categoryBreakdown: CategoryBreakdownItem[];
  topCustomers: TopCustomer[];
}

type ListResponse<T> = { success: boolean; data: T[] };

const listOrEmpty = <T,>(res: unknown): T[] => {
  const r = res as ListResponse<T> | undefined;
  return r?.success && Array.isArray(r.data) ? r.data : [];
};

/**
 * Cached reports — keyed by date range with keepPreviousData, so changing the
 * range keeps the current report on screen while the new one loads, and
 * revisiting a range you already viewed renders instantly.
 */
export function useReports() {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfDay(subDays(new Date(), 29)),
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
      const range = { startDate: startISO, endDate: endISO };
      const [
        metricsData,
        salesTime,
        topProductsResponse,
        leastProductsResponse,
        paymentResponse,
        categoryResponse,
        customersResponse,
      ] = await Promise.all([
        window.ipcRenderer.invoke("get-total-sales-metrics", range),
        window.ipcRenderer.invoke("get-sales-over-time", { ...range, interval }),
        window.ipcRenderer.invoke("get-top-selling-products", { ...range, limit: 5 }),
        window.ipcRenderer.invoke("get-least-selling-products", { ...range, limit: 5 }),
        window.ipcRenderer.invoke("get-payment-breakdown", range),
        window.ipcRenderer.invoke("get-category-breakdown", range),
        window.ipcRenderer.invoke("get-top-customers", { ...range, limit: 5 }),
      ]);

      return {
        rawMetricsData: metricsData,
        salesOverTime: Array.isArray(salesTime) ? (salesTime as SalesOverTimeData[]) : [],
        topSellingProducts: listOrEmpty<SellingProduct>(topProductsResponse),
        leastSellingProducts: listOrEmpty<SellingProduct>(leastProductsResponse),
        paymentBreakdown: listOrEmpty<PaymentBreakdownItem>(paymentResponse),
        categoryBreakdown: listOrEmpty<CategoryBreakdownItem>(categoryResponse),
        topCustomers: listOrEmpty<TopCustomer>(customersResponse),
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
  const paymentBreakdown = query.data?.paymentBreakdown ?? [];
  const categoryBreakdown = query.data?.categoryBreakdown ?? [];
  const topCustomers = query.data?.topCustomers ?? [];

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

  // ---- Export (todo se recalcula en main; sólo enviamos el rango) ----
  const [exporting, setExporting] = useState<ExportKind | null>(null);

  const runExport = useCallback(
    async (kind: ExportKind) => {
      const channel = kind === "pdf" ? "generate-sales-report-pdf" : "export-sales-report-csv";
      const label = kind.toUpperCase();
      setExporting(kind);
      try {
        const result = (await window.ipcRenderer.invoke(channel, {
          startDate: startISO,
          endDate: endISO,
          interval,
        })) as { success: boolean; filePath?: string; canceled?: boolean; message?: string };

        if (result.canceled) return; // el usuario canceló el diálogo de guardado — silencio

        if (result.success) {
          toast.success(`${label} generado`, {
            description: result.filePath ? `El reporte ha sido guardado en: ${result.filePath}` : undefined,
          });
        } else {
          toast.error(`Error al generar ${label}`, { description: result.message || "No se pudo generar el reporte." });
        }
      } catch (error: unknown) {
        console.error(`Error generating ${label}:`, error);
        toast.error(`Error al generar ${label}`, { description: (error as Error).message || "Ocurrió un error inesperado." });
      } finally {
        setExporting(null);
      }
    },
    [startISO, endISO, interval],
  );

  const handleGeneratePDF = useCallback(() => runExport("pdf"), [runExport]);
  const handleGenerateCSV = useCallback(() => runExport("csv"), [runExport]);

  return {
    dateRange,
    setDateRange,
    loading: query.isPending,
    salesMetrics,
    salesOverTime,
    interval,
    topSellingProducts,
    leastSellingProducts,
    paymentBreakdown,
    categoryBreakdown,
    topCustomers,
    exporting,
    handleGeneratePDF,
    handleGenerateCSV,
  };
}
