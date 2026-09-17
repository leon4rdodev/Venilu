import { useQuery } from "@tanstack/react-query";
import { Truck, CircleDollarSign, AlertCircle, ShoppingCart, CalendarClock, HandCoins } from "lucide-react";
import { CustomerMetricCard as MetricCard } from "@renderer/features/customers/components/customer-metric-card";
import { formatCurrency } from "@lib/currency";
import { ipc } from "@lib/ipc";
import type { SupplierStats, IpcResult } from "../types";

const EMPTY: SupplierStats = {
  totalSuppliers: 0, activeSuppliers: 0, suppliersWithDebt: 0, totalPayable: 0,
  purchasesThisMonth: 0, purchasedThisMonth: 0, overduePurchases: 0, overdueAmount: 0, paidThisMonth: 0,
};

type Trend = "up" | "down" | "neutral";

const plural = (n: number, singular: string, pluralForm: string) => `${n} ${n === 1 ? singular : pluralForm}`;

export function SuppliersStats() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["supplier-stats"],
    queryFn: async () => {
      const result = (await ipc.invoke("suppliers:stats")) as IpcResult<SupplierStats>;
      if (!result.success || !result.data) throw new Error(result.message || "Error al cargar estadísticas");
      return result.data;
    },
  });
  const s = data ?? EMPTY;

  // Mientras carga (o si falla) las tarjetas muestran un marcador en lugar de un
  // "0 / Al día" engañoso — HIG Loading: mostrar algo cuanto antes; HIG Feedback:
  // nunca presentar un fallo como un cero exitoso. Misma mecánica que Clientes.
  const unavailable = isPending || isError;
  const money = (n: number) => (unavailable ? "—" : formatCurrency(n));
  const count = (n: number) => (unavailable ? "—" : n);
  const badge = (label: string | undefined) => (unavailable ? undefined : label);
  const inactive = s.totalSuppliers - s.activeSuppliers;

  const stats: { title: string; value: string | number; icon: typeof Truck; trend?: Trend; change?: string }[] = [
    {
      title: "Cuentas por Pagar",
      value: money(s.totalPayable),
      icon: CircleDollarSign,
      trend: s.totalPayable > 0 ? "down" : "neutral",
      change: badge(s.totalPayable > 0 ? plural(s.suppliersWithDebt, "suplidor", "suplidores") : "Al día"),
    },
    {
      title: "Vencido",
      value: money(s.overdueAmount),
      icon: CalendarClock,
      trend: s.overdueAmount > 0 ? "down" : "neutral",
      change: badge(s.overdueAmount > 0 ? plural(s.overduePurchases, "compra", "compras") : "Nada vencido"),
    },
    {
      title: "Compras del Mes",
      value: money(s.purchasedThisMonth),
      icon: ShoppingCart,
      trend: s.purchasesThisMonth > 0 ? "up" : "neutral",
      change: badge(s.purchasesThisMonth > 0 ? plural(s.purchasesThisMonth, "compra", "compras") : "Sin compras"),
    },
    {
      title: "Pagado este Mes",
      value: money(s.paidThisMonth),
      icon: HandCoins,
    },
    {
      title: "Con Cuenta Pendiente",
      value: count(s.suppliersWithDebt),
      icon: AlertCircle,
      trend: s.suppliersWithDebt > 0 ? "down" : "neutral",
      change: badge(s.suppliersWithDebt > 0 ? "Pendiente" : "Ninguno"),
    },
    {
      title: "Suplidores Activos",
      value: count(s.activeSuppliers),
      icon: Truck,
      trend: "neutral",
      change: badge(inactive > 0 ? plural(inactive, "inactivo", "inactivos") : undefined),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {stats.map((stat, index) => (
        <MetricCard key={stat.title} index={index} {...stat} />
      ))}
    </div>
  );
}
