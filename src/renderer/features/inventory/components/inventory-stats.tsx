
import { useState, useEffect, useCallback } from "react"
import { Package, DollarSign, AlertTriangle, XCircle } from "lucide-react"
import { formatCurrency } from "@lib/currency"
import { InventoryMetricCard } from "./inventory-metric-card"
import { ipc } from "@lib/ipc"

interface InventoryStatsData {
  totalProducts: number
  totalStockValue: number
  lowStockProducts: number
  outOfStockProducts: number
}

export function InventoryStats() {
  const [statsData, setStatsData] = useState<InventoryStatsData>({
    totalProducts: 0,
    totalStockValue: 0,
    lowStockProducts: 0,
    outOfStockProducts: 0,
  })

  const fetchStats = useCallback(async () => {
    try {
      const result = await ipc.invoke('get-inventory-stats') as {
        success: boolean
        stats?: InventoryStatsData
        message?: string
      }
      if (result.success && result.stats) {
        setStatsData(result.stats)
      }
    } catch (error) {
      console.error('Error fetching inventory stats:', error)
    }
  }, [])

  useEffect(() => {
    fetchStats()

    // Re-fetch when products change (listen for custom events)
    const handleProductsChanged = () => fetchStats()
    window.addEventListener('inventory-updated', handleProductsChanged)
    window.addEventListener('categories-updated', handleProductsChanged)

    return () => {
      window.removeEventListener('inventory-updated', handleProductsChanged)
      window.removeEventListener('categories-updated', handleProductsChanged)
    }
  }, [fetchStats])

  const stats = [
    {
      title: "Total de Productos",
      value: statsData.totalProducts,
      icon: Package,

    },
    {
      title: "Valor del Inventario",
      value: formatCurrency(statsData.totalStockValue),
      icon: DollarSign,

    },
    {
      title: "Bajo Stock",
      value: statsData.lowStockProducts,
      icon: AlertTriangle,

      trend: statsData.lowStockProducts > 0 ? "down" : "neutral" as "down" | "neutral" | "up",
      change: statsData.lowStockProducts > 0 ? "Atención" : "Normal"
    },
    {
      title: "Agotados",
      value: statsData.outOfStockProducts,
      icon: XCircle,

      trend: statsData.outOfStockProducts > 0 ? "down" : "neutral" as "down" | "neutral" | "up",
      change: statsData.outOfStockProducts > 0 ? "Crítico" : "Óptimo"
    }
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <InventoryMetricCard
          key={index}
          index={index}
          {...stat}
        />
      ))}
    </div>
  )
}
