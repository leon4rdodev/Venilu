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

export function CustomersStats() {
  // Cached — invalidated by the CacheBridge on every 'customers-updated' event
  const { data } = useQuery({
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

  const stats = [
    {
      title: "Deuda Total",
      value: formatCurrency(statsData.totalDebt),
      icon: CircleDollarSign,
      trend: (statsData.totalDebt > 0 ? "down" : "neutral") as "up" | "down" | "neutral",
      change: statsData.totalDebt > 0 ? "Pendiente" : "Sin deudas",
    },
    {
      title: "Deuda Promedio",
      value: formatCurrency(avgDebt),
      icon: Wallet,
    },
    {
      title: "Clientes con Deuda",
      value: statsData.customersWithDebt,
      icon: AlertCircle,
      trend: (statsData.customersWithDebt > 0 ? "down" : "neutral") as "up" | "down" | "neutral",
      change: statsData.customersWithDebt > 0 ? `${statsData.customersWithDebt} clientes` : "Ninguno",
    },
    {
      title: "Activos (30 días)",
      value: statsData.activeThisMonth,
      icon: Activity,
      trend: (statsData.activeThisMonth > 0 ? "up" : "neutral") as "up" | "down" | "neutral",
      change: statsData.activeThisMonth > 0 ? "Comprando" : "Sin actividad",
    },
    {
      title: "Nuevos este Mes",
      value: statsData.newThisMonth,
      icon: UserPlus,
      trend: (statsData.newThisMonth > 0 ? "up" : "neutral") as "up" | "down" | "neutral",
      change: statsData.newThisMonth > 0 ? `+${statsData.newThisMonth}` : "—",
    },
    {
      title: "Total de Clientes",
      value: statsData.totalCustomers,
      icon: Users,
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {stats.map((stat, index) => (
        <CustomerMetricCard
          key={stat.title}
          index={index}
          {...stat}
        />
      ))}
    </div>
  )
}
