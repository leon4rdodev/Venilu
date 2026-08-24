import { ReportsHeader } from "./reports-header";
import { SalesMetricsGrid } from "./sales-metrics-grid";
import { SalesOverTimeChart } from "./sales-over-time-chart";
import { TopSellingProductsTable } from "./top-selling-products-table";
import { LeastSellingProductsTable } from "./least-selling-products-table";
import { PageHeader } from "@renderer/shared/components/page-header";
import { useReports } from "../hooks/use-reports";

export function ReportsInterface() {
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
        action={<ReportsHeader onDateRangeChange={setDateRange} onGeneratePDF={handleGeneratePDF} />}
      />

      {/* Page entrance is handled by AnimatedPage — no extra animation layers */}
      <div className="space-y-6">
        <SalesMetricsGrid salesMetrics={salesMetrics} loading={loading} />

        <SalesOverTimeChart salesOverTime={salesOverTime} loading={loading} interval={interval} />

        <div className="grid gap-6 md:grid-cols-2">
          <TopSellingProductsTable topSellingProducts={topSellingProducts} loading={loading} />
          <LeastSellingProductsTable leastSellingProducts={leastSellingProducts} loading={loading} />
        </div>
      </div>
    </div>
  );
}
