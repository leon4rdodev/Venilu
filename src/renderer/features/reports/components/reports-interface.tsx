import { useSidebar } from "@renderer/features/layout";
import { ReportsHeader } from "./reports-header";
import { SalesMetricsGrid } from "./sales-metrics-grid";
import { SalesOverTimeChart } from "./sales-over-time-chart";
import { TopSellingProductsTable } from "./top-selling-products-table";
import { LeastSellingProductsTable } from "./least-selling-products-table";
import { PageHeader } from "@renderer/shared/components/page-header";
import { motion } from "framer-motion";
import { useReports } from "../hooks/use-reports";

export function ReportsInterface() {
  const { isToggling: isSidebarToggling } = useSidebar();
  const {
    setDateRange,
    loading,
    salesMetrics,
    salesOverTime,
    interval,
    topSellingProducts,
    leastSellingProducts,
    handleGeneratePDF,
  } = useReports();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes"
        description="Análisis de ventas, márgenes y productos para el período seleccionado."
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="space-y-6"
      >
        <ReportsHeader onDateRangeChange={setDateRange} onGeneratePDF={handleGeneratePDF} />

        <SalesMetricsGrid salesMetrics={salesMetrics} loading={loading} />

        {isSidebarToggling ? (
          <div className="h-64 flex items-center justify-center">
            <p className="text-muted-foreground">Cargando gráfico...</p>
          </div>
        ) : (
          <SalesOverTimeChart salesOverTime={salesOverTime} loading={loading} interval={interval} />
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <TopSellingProductsTable topSellingProducts={topSellingProducts} loading={loading} />
          <LeastSellingProductsTable leastSellingProducts={leastSellingProducts} loading={loading} />
        </div>
      </motion.div>
    </div>
  );
}
