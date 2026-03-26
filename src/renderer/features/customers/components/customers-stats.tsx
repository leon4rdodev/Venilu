import { useState, useEffect, useCallback } from "react"
import { Users, Activity, CircleDollarSign, AlertCircle } from "lucide-react"
import { CustomerMetricCard } from "./customer-metric-card"
import { ipc } from "@lib/ipc"

interface CustomerStatsData {
  totalDebt: number
  totalCustomers: number
  newThisMonth: number
  customersWithDebt: number
  activeThisMonth: number
}

export function CustomersStats() {
  const [statsData, setStatsData] = useState<CustomerStatsData>({
    totalDebt: 0,
    totalCustomers: 0,
    newThisMonth: 0,
    customersWithDebt: 0,
    activeThisMonth: 0,
  })

  const fetchStats = useCallback(async () => {
    try {
      const result = await ipc.invoke('get-customer-stats') as {
        success: boolean
        data?: CustomerStatsData
        message?: string
      }
      if (result.success && result.data) {
        setStatsData(result.data)
      }
    } catch (error) {
      console.error('Error fetching customer stats:', error)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    const handleCustomersChanged = () => fetchStats()
    window.addEventListener('customers-updated', handleCustomersChanged)
    return () => {
      window.removeEventListener('customers-updated', handleCustomersChanged)
    }
  }, [fetchStats])

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP' }).format(amount)

  const stats = [
    {
      title: "Deuda Total",
      value: formatCurrency(statsData.totalDebt),
      icon: CircleDollarSign,
      trend: statsData.totalDebt > 0 ? "down" : "neutral" as "up" | "down" | "neutral",
      change: statsData.totalDebt > 0 ? "Pendiente" : "Sin deudas",
    },
    {
      title: "Clientes con Deuda",
      value: statsData.customersWithDebt,
      icon: AlertCircle,
      trend: statsData.customersWithDebt > 0 ? "down" : "neutral" as "up" | "down" | "neutral",
      change: statsData.customersWithDebt > 0 ? `${statsData.customersWithDebt} clientes` : "Ninguno",
    },
    {
      title: "Activos este Mes",
      value: statsData.activeThisMonth,
      icon: Activity,
      trend: statsData.activeThisMonth > 0 ? "up" : "neutral" as "up" | "down" | "neutral",
      change: statsData.activeThisMonth > 0 ? `+${statsData.activeThisMonth}` : "Sin actividad",
    },
    {
      title: "Total de Clientes",
      value: statsData.totalCustomers,
      icon: Users,
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <CustomerMetricCard
          key={index}
          index={index}
          {...stat}
        />
      ))}
    </div>
  )
}
