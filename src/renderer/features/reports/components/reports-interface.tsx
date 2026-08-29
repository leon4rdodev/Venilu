import { ReportsHeader } from "./reports-header";
import { SalesMetricsGrid } from "./sales-metrics-grid";
import { SalesOverTimeChart } from "./sales-over-time-chart";
import { PaymentBreakdownWidget } from "./payment-breakdown-widget";
import { CategoryBreakdownWidget } from "./category-breakdown-widget";
import { TopSellingProductsTable } from "./top-selling-products-table";
import { LeastSellingProductsTable } from "./least-selling-products-table";
import { TopCustomersWidget } from "./top-customers-widget";
import { PageHeader } from "@renderer/shared/components/page-header";
import { useMinimumLoading } from "@renderer/shared/hooks/use-minimum-loading";
import { useReports } from "../hooks/use-reports";

export function ReportsInterface() {
  const {
    dateRange,
    setDateRange,
    loading,
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
  } = useReports();

  // Skeletons held for 500ms so local IPC (~50ms) doesn't flash them
  const showSkeleton = useMinimumLoading(loading, 500);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reportes"
        description="Análisis de ventas, márgenes y productos para el período seleccionado."
      />

      {/* Toolbar: presets de rango · rango custom · exportar */}
      <ReportsHeader
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        exporting={exporting}
        onGeneratePDF={handleGeneratePDF}
        onGenerateCSV={handleGenerateCSV}
      />

      {/* Page entrance is handled by AnimatedPage — no extra animation layers */}
      <div className="space-y-6">
        <SalesMetricsGrid salesMetrics={salesMetrics} loading={showSkeleton} />

        <SalesOverTimeChart salesOverTime={salesOverTime} loading={showSkeleton} interval={interval} />

        <div className="grid gap-6 md:grid-cols-2">
          <PaymentBreakdownWidget paymentBreakdown={paymentBreakdown} loading={showSkeleton} />
          <CategoryBreakdownWidget categoryBreakdown={categoryBreakdown} loading={showSkeleton} />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <TopSellingProductsTable topSellingProducts={topSellingProducts} loading={showSkeleton} />
          <LeastSellingProductsTable leastSellingProducts={leastSellingProducts} loading={showSkeleton} />
        </div>

        <TopCustomersWidget topCustomers={topCustomers} loading={showSkeleton} />
      </div>
    </div>
  );
}
