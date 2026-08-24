import { CustomersTable } from "@renderer/features/customers"
import { PageHeader } from "@renderer/shared/components/page-header"

export default function CustomersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Administra tu base de clientes"
      />
      {/* Page entrance is handled by AnimatedPage — no extra animation layers */}
      <CustomersTable />
    </div>
  )
}
