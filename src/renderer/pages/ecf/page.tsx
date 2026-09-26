import { EcfInterface } from '@renderer/features/ecf'
import { PageHeader } from '@renderer/shared/components/page-header'

export default function EcfPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Comprobantes Electrónicos (e-CF)"
        description="Comprobantes fiscales emitidos, firmados y validados por la DGII"
      />
      <EcfInterface />
    </div>
  )
}
