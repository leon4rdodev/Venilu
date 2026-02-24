import { useState, useEffect, useCallback } from "react"
import { Users, UserPlus, Mail, Phone } from "lucide-react"
import { CustomerMetricCard } from "./customer-metric-card"
import { ipc } from "@lib/ipc"

interface CustomerStatsData {
  totalCustomers: number
  newThisMonth: number
  withEmail: number
  withPhone: number
}

export function CustomersStats() {
  const [statsData, setStatsData] = useState<CustomerStatsData>({
    totalCustomers: 0,
    newThisMonth: 0,
    withEmail: 0,
    withPhone: 0,
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

  const stats = [
    {
      title: "Total de Clientes",
      value: statsData.totalCustomers,
      icon: Users,
    },
    {
      title: "Nuevos este Mes",
      value: statsData.newThisMonth,
      icon: UserPlus,
      trend: statsData.newThisMonth > 0 ? "up" : "neutral" as "up" | "down" | "neutral",
      change: statsData.newThisMonth > 0 ? `+${statsData.newThisMonth}` : "Sin cambios"
    },
    {
      title: "Con Email",
      value: statsData.withEmail,
      icon: Mail,
    },
    {
      title: "Con Teléfono",
      value: statsData.withPhone,
      icon: Phone,
    }
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
