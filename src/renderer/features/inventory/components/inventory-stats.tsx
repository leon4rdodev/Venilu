import { useQuery } from "@tanstack/react-query"
import { Package, DollarSign, AlertTriangle, XCircle, Layers, Percent, Tag } from "lucide-react"
import { formatCurrency } from "@lib/currency"
import { cn } from "@lib/utils"
import { InventoryMetricCard } from "./inventory-metric-card"
import { ipc } from "@lib/ipc"

interface InventoryStatsData {
  totalProducts: number
  totalStockUnits: number
  totalStockValue: number | null
  totalRetailValue: number
  lowStockProducts: number
  outOfStockProducts: number
}

const EMPTY_STATS: InventoryStatsData = {
  totalProducts: 0,
  totalStockUnits: 0,
  totalStockValue: 0,
  totalRetailValue: 0,
  lowStockProducts: 0,
  outOfStockProducts: 0,
}

export function InventoryStats() {
  // Cached — the CacheBridge invalidates on 'inventory-updated'/'categories-updated'
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['inventory-stats'],
    queryFn: async () => {
      const result = await ipc.invoke('get-inventory-stats') as {
        success: boolean
        data?: InventoryStatsData
        message?: string
      }
      if (!result.success || !result.data) {
        throw new Error(result.message || 'Error al cargar estadísticas de inventario')
      }
      return { ...EMPTY_STATS, ...result.data }
    },
  })

  const statsData = data ?? EMPTY_STATS

  // Potential gross margin if the whole stock sold at current prices
  const potentialMargin = statsData.totalRetailValue > 0 && statsData.totalStockValue != null
    ? ((statsData.totalRetailValue - statsData.totalStockValue) / statsData.totalRetailValue) * 100
    : 0

  // null = the server stripped it (user lacks inventory:view_costs)
  const canSeeCosts = statsData.totalStockValue !== null && statsData.totalStockValue !== undefined

  const stats = [
    {
      title: "Total de Productos",
      value: statsData.totalProducts.toLocaleString("es-DO"),
      icon: Package,
    },
    {
      title: "Unidades en Stock",
      value: statsData.totalStockUnits.toLocaleString("es-DO"),
      icon: Layers,
    },
    ...(canSeeCosts ? [{
      title: "Inversión (Costo)",
      value: formatCurrency(statsData.totalStockValue ?? 0),
      icon: DollarSign,
    }] : []),
    {
      title: "Valor de Venta",
      value: formatCurrency(statsData.totalRetailValue),
      icon: Tag,
    },
    ...(canSeeCosts ? [{
      title: "Margen Potencial",
      value: `${potentialMargin.toFixed(1)}%`,
      icon: Percent,
      trend: (potentialMargin > 0 ? "up" : "neutral") as "up" | "neutral" | "down",
      change: potentialMargin > 0 ? "Ganancia" : "—",
    }] : []),
    {
      title: "Bajo Stock",
      value: statsData.lowStockProducts,
      icon: AlertTriangle,
      trend: (statsData.lowStockProducts > 0 ? "down" : "neutral") as "down" | "neutral" | "up",
      change: statsData.lowStockProducts > 0 ? "Atención" : "Normal",
    },
    {
      title: "Agotados",
      value: statsData.outOfStockProducts,
      icon: XCircle,
      trend: (statsData.outOfStockProducts > 0 ? "down" : "neutral") as "down" | "neutral" | "up",
      change: statsData.outOfStockProducts > 0 ? "Crítico" : "Óptimo",
    },
  ]

  // Sin permiso de costos hay 5 tarjetas: que la fila se reparta sin huecos
  const cardCount = stats.length

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4",
          cardCount >= 7 ? "xl:grid-cols-7" : "xl:grid-cols-5"
        )}
        aria-busy={isPending}
      >
        {stats.map((stat, index) => (
          <InventoryMetricCard
            key={stat.title}
            index={index}
            isLoading={isPending}
            {...stat}
            {...(isError ? { value: "—", change: undefined, trend: undefined } : {})}
          />
        ))}
      </div>
      {isError && (
        <p className="text-xs text-destructive" role="alert">
          No se pudieron cargar las estadísticas de inventario
          {error instanceof Error && error.message ? `: ${error.message}` : "."}
        </p>
      )}
    </div>
  )
}
