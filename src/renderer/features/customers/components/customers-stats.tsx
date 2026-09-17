import { useQuery } from "@tanstack/react-query"
import { Users, Activity, CircleDollarSign, AlertCircle, UserPlus, Wallet } from "lucide-react"
import { CustomerMetricCard } from "./customer-metric-card"
import { formatCurrency } from "@lib/currency"
import { ipc } from "@lib/ipc"

interface CustomerStatsData {
  totalDebt: number
  totalCustomers: number
  newThisMonth: number
  customersWithDebt: number
  activeThisMonth: number
}

const EMPTY: CustomerStatsData = {
  totalDebt: 0,
  totalCustomers: 0,
  newThisMonth: 0,
  customersWithDebt: 0,
  activeThisMonth: 0,
}

type Trend = "up" | "down" | "neutral"

export function CustomersStats() {
  // Cached — invalidated by the CacheBridge on every 'customers-updated' event
  const { data, isPending, isError } = useQuery({
    queryKey: ['customer-stats'],
    queryFn: async () => {
      const result = await ipc.invoke('get-customer-stats') as {
        success: boolean
        data?: CustomerStatsData
        message?: string
      }
      if (!result.success || !result.data) {
        throw new Error(result.message || 'Error al cargar estadísticas')
      }
      return result.data
    },
  })

  const statsData = data ?? EMPTY

  const avgDebt = statsData.customersWithDebt > 0
    ? statsData.totalDebt / statsData.customersWithDebt
    : 0

  // While loading (or on error) the cards show a placeholder instead of a
  // misleading "0 / Sin deudas" — HIG Loading: "show something as soon as possible",
  // HIG Feedback: never present a failure as a successful zero.
  const unavailable = isPending || isError
  const money = (n: number) => (unavailable ? "—" : formatCurrency(n))
  const count = (n: number) => (unavailable ? "—" : n)
  const badge = (label: string) => (unavailable ? undefined : label)

  const stats: {
    title: string
    value: string | number
    icon: typeof Users
    trend?: Trend
    change?: string
  }[] = [
    {
      title: "Deuda Total",
      value: money(statsData.totalDebt),
      icon: CircleDollarSign,
      trend: statsData.totalDebt > 0 ? "down" : "neutral",
      change: badge(statsData.totalDebt > 0 ? "Pendiente" : "Sin deudas"),
    },
    {
      title: "Deuda Promedio",
      value: money(avgDebt),
      icon: Wallet,
    },
    {
      title: "Clientes con Deuda",
      value: count(statsData.customersWithDebt),
      icon: AlertCircle,
      trend: statsData.customersWithDebt > 0 ? "down" : "neutral",
      change: badge(
        statsData.customersWithDebt > 0
          ? `${statsData.customersWithDebt} cliente${statsData.customersWithDebt !== 1 ? "s" : ""}`
          : "Ninguno"
      ),
    },
    {
      title: "Activos (30 días)",
      value: count(statsData.activeThisMonth),
      icon: Activity,
      trend: statsData.activeThisMonth > 0 ? "up" : "neutral",
      change: badge(statsData.activeThisMonth > 0 ? "Comprando" : "Sin actividad"),
    },
    {
      title: "Nuevos este Mes",
      value: count(statsData.newThisMonth),
      icon: UserPlus,
      trend: statsData.newThisMonth > 0 ? "up" : "neutral",
      change: badge(statsData.newThisMonth > 0 ? `+${statsData.newThisMonth}` : "—"),
    },
    {
      title: "Total de Clientes",
      value: count(statsData.totalCustomers),
      icon: Users,
    },
  ]

  return (
    <section aria-label="Resumen de clientes" className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat, index) => (
          <CustomerMetricCard
            key={stat.title}
            index={index}
            loading={isPending}
            {...stat}
          />
        ))}
      </div>
      {isError && (
        <p role="status" className="text-xs text-muted-foreground flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" strokeWidth={1.75} aria-hidden="true" />
          No se pudieron cargar las estadísticas de clientes.
        </p>
      )}
    </section>
  )
}
