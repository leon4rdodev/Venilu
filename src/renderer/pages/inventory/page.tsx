import { InventoryTable } from "@renderer/features/inventory"
import { PageHeader } from "@renderer/shared/components/page-header"

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestión de Inventario"
        description="Administra los productos y el stock disponible"
      />
      {/* Page entrance is handled by AnimatedPage — no extra animation layers */}
      <InventoryTable />
    </div>
  )
}
