import { motion } from "framer-motion";
import { MetricCard } from "./components/metric-card";
import { TopProductsChart } from "./components/top-products-chart";
import { RecentSalesWidget } from "./components/recent-sales-widget";
import { LowStockWidget } from "./components/low-stock-widget";
import { PageHeader } from "@renderer/shared/components/page-header";
import { useDashboard } from "./hooks/use-dashboard";

export default function DashboardPage() {
  const { loading, statCards, topProducts, recentSales, lowStockProducts } = useDashboard();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Resumen en tiempo real de las operaciones y métricas clave de tu negocio."
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="space-y-6"
      >
        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-32 bg-muted/20 animate-pulse rounded-xl border border-muted/20"
                />
              ))
            : statCards.map((stat, index) => (
                <MetricCard key={stat.title} index={index} {...stat} />
              ))}
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
  );
}
