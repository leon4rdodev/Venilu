import { MetricCard } from "./components/metric-card";
import { SalesByHourChart } from "./components/sales-by-hour-chart";
import { PaymentMethodsWidget } from "./components/payment-methods-widget";
import { RecentSalesWidget } from "./components/recent-sales-widget";
import { LowStockWidget } from "./components/low-stock-widget";
import { PageHeader } from "@renderer/shared/components/page-header";
import { useDashboard } from "./hooks/use-dashboard";

export default function DashboardPage() {
  const {
    loading,
    statCards,
    hourlySales,
    hourlyDay,
    setHourlyDay,
    paymentTotals,
    recentSales,
    lowStockProducts,
    canViewSummary,
    canViewSales,
    canViewStock,
  } = useDashboard();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Resumen en tiempo real de las operaciones y métricas clave de tu negocio."
      />

      {/* Page entrance is handled by AnimatedPage — no double animation here */}
      <div className="space-y-6">
        {/* Stats row — 7 compact cards on wide screens */}
        {(canViewSummary || canViewStock) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
            {loading
              ? Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="h-28 bg-muted/40 animate-pulse rounded-lg border border-border" />
                ))
              : statCards.map((stat, index) => (
                  <MetricCard key={stat.title} index={index} {...stat} />
                ))}
          </div>
        )}

        {/* Main split: chart + recent sales | payment methods + restock */}
        <div className="grid gap-6 lg:grid-cols-3 items-start">
          <div className="lg:col-span-2 space-y-6">
            {canViewSummary && (
              <SalesByHourChart data={hourlySales} day={hourlyDay} onDayChange={setHourlyDay} />
            )}
            {canViewSales && <RecentSalesWidget sales={recentSales} loading={loading} />}
          </div>
          <div className="space-y-6">
            {canViewSummary && <PaymentMethodsWidget data={paymentTotals} loading={loading} />}
            {canViewStock && <LowStockWidget products={lowStockProducts} loading={loading} />}
          </div>
        </div>
      </div>
    </div>
  );
}
