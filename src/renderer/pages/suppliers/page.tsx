import { SuppliersInterface } from "@renderer/features/suppliers"
import { PageHeader } from "@renderer/shared/components/page-header"

export default function SuppliersPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Suplidores"
        description="Proveedores, compras de mercancía y cuentas por pagar"
      />
      <SuppliersInterface />
    </div>
  )
}
