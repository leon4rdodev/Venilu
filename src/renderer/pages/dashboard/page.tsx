import { LayoutDashboard } from "lucide-react";
import { MetricCard, MetricCardSkeleton } from "./components/metric-card";
import { SalesByHourChart } from "./components/sales-by-hour-chart";
import { PaymentMethodsWidget } from "./components/payment-methods-widget";
import { RecentSalesWidget } from "./components/recent-sales-widget";
import { LowStockWidget } from "./components/low-stock-widget";
import { PageHeader } from "@renderer/shared/components/page-header";
import { cn } from "@lib/utils";
import { useDashboard } from "./hooks/use-dashboard";

export default function DashboardPage() {
  const {
    loading,
    statCards,
    hourlySales,
    hourlyLoading,
    hourlyDay,
    setHourlyDay,
    paymentTotals,
    recentSales,
    lowStockProducts,
    canViewSummary,
    canViewSales,
    canViewStock,
  } = useDashboard();

  const canViewAnything = canViewSummary || canViewSales || canViewStock;

  // Skeleton count mirrors the cards this user will actually see (5 sales + 2 stock)
  const expectedCards = (canViewSummary ? 5 : 0) + (canViewStock ? 2 : 0);
  const cardCount = loading ? expectedCards : statCards.length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Resumen en tiempo real de las operaciones y métricas clave de tu negocio."
      />

      {/* Page entrance is handled by AnimatedPage — no double animation here */}
      {!canViewAnything ? (
        <div className="bg-card border border-border rounded-lg flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-3">
            <LayoutDashboard className="h-6 w-6 text-muted-foreground/50" strokeWidth={1.5} />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            No tienes permisos para ver las métricas del negocio
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats row — up to 7 compact cards on wide screens */}
          {(canViewSummary || canViewStock) && (
            <section
              aria-label="Métricas del día"
              aria-busy={loading}
              className={cn(
                "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4",
                cardCount >= 7 ? "xl:grid-cols-7" : cardCount >= 5 ? "xl:grid-cols-5" : ""
              )}
            >
              {loading
                ? Array.from({ length: expectedCards }).map((_, i) => <MetricCardSkeleton key={i} />)
                : statCards.map((stat, index) => (
                    <MetricCard key={stat.title} index={index} {...stat} />
                  ))}
            </section>
          )}

          {/* Main split: chart + recent sales | payment methods + restock */}
          <div className="grid gap-6 lg:grid-cols-3 items-start">
            <div className="lg:col-span-2 space-y-6">
              {canViewSummary && (
                <SalesByHourChart
                  data={hourlySales}
                  loading={hourlyLoading}
                  day={hourlyDay}
                  onDayChange={setHourlyDay}
                />
              )}
              {canViewSales && <RecentSalesWidget sales={recentSales} loading={loading} />}
            </div>
            <div className="space-y-6">
              {canViewSummary && <PaymentMethodsWidget data={paymentTotals} loading={loading} />}
              {canViewStock && <LowStockWidget products={lowStockProducts} loading={loading} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
