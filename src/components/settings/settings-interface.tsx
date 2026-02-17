
import { Building2, Users, Printer, Database } from "lucide-react"
import { motion } from "framer-motion"
import { BusinessSettings } from "./business-settings"
import { UserSettings } from "./user-settings"
import { PrinterSettings } from "./printer-settings"
import { BackupSettings } from "./backup-settings"

export function SettingsInterface() {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4 } }
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Ajustes</h1>
        <p className="text-muted-foreground text-sm max-w-2xl text-balance">
          Configura las preferencias y parámetros del sistema
        </p>
      </motion.div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Business Settings - Full Width on large screens if desired, or half */}
        <motion.div variants={item} className="space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2 text-lg font-semibold text-foreground/80">
            <Building2 className="h-5 w-5 text-primary" />
            <h2>Información del Negocio</h2>
          </div>
          <BusinessSettings />
        </motion.div>

        {/* User Settings */}
        <motion.div variants={item} className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold text-foreground/80">
            <Users className="h-5 w-5 text-primary" />
            <h2>Gestión de Usuarios</h2>
          </div>
          <UserSettings />
        </motion.div>

        {/* Printer Settings */}
        <motion.div variants={item} className="space-y-4">
          <div className="flex items-center gap-2 text-lg font-semibold text-foreground/80">
            <Printer className="h-5 w-5 text-primary" />
            <h2>Configuración de Impresora</h2>
          </div>
          <PrinterSettings />
        </motion.div>

        {/* Backup Settings - Full Width for better accessibility */}
        <motion.div variants={item} className="space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2 text-lg font-semibold text-foreground/80">
            <Database className="h-5 w-5 text-primary" />
            <h2>Copias de Seguridad</h2>
          </div>
          <BackupSettings />
        </motion.div>
      </motion.div>
    </div>
  )
}