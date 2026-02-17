import { InventoryTable } from "@components/inventory/inventory-table"
import { motion } from "framer-motion"

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <motion.div
           initial={{ opacity: 0, x: -20 }}
           animate={{ opacity: 1, x: 0 }}
           transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Gestión de Inventario</h1>
          <p className="text-muted-foreground">Administra los productos y el stock disponible</p>
        </motion.div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <InventoryTable />
      </motion.div>
    </div>
  )
}
