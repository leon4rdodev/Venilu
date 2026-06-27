import { Building2, Users, Printer, Database, ShieldCheck, FileText } from "lucide-react"
import { motion } from "framer-motion"
import { BusinessSettings } from "./business-settings"
import { UserSettings } from "./user-settings"
import { PrinterSettings } from "./printer-settings"
import { BackupSettings } from "./backup-settings"
import { RolesSettings } from "./roles-settings"
import { NcfSettings } from "./ncf-settings"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs"

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
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } }
  };

  return (
    <div className="space-y-6 pb-10">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Ajustes</h1>
        <p className="text-muted-foreground text-sm max-w-2xl text-balance mt-1">
          Configura las preferencias y parámetros del sistema
        </p>
      </motion.div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
      >
        <Tabs defaultValue="business" className="flex flex-col md:flex-row gap-6 md:gap-10 items-start">
          <motion.div variants={item} className="w-full md:w-64 shrink-0 sticky top-6">
            <TabsList className="flex md:flex-col h-auto w-full bg-transparent justify-start p-0 gap-1 overflow-x-auto md:overflow-visible">
              <TabsTrigger 
                value="business" 
                className="w-full justify-start gap-3 py-2.5 px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none border-none rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <Building2 className="h-4 w-4" />
                Negocio
              </TabsTrigger>
              <TabsTrigger 
                value="users" 
                className="w-full justify-start gap-3 py-2.5 px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none border-none rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <Users className="h-4 w-4" />
                Usuarios
              </TabsTrigger>
              <TabsTrigger 
                value="roles" 
                className="w-full justify-start gap-3 py-2.5 px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none border-none rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <ShieldCheck className="h-4 w-4" />
                Roles y Permisos
              </TabsTrigger>
              <TabsTrigger 
                value="printer" 
                className="w-full justify-start gap-3 py-2.5 px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none border-none rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <Printer className="h-4 w-4" />
                Impresora
              </TabsTrigger>
              <TabsTrigger 
                value="backup" 
                className="w-full justify-start gap-3 py-2.5 px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none border-none rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <Database className="h-4 w-4" />
                Copias de Seguridad
              </TabsTrigger>
              <TabsTrigger 
                value="ecf" 
                className="w-full justify-start gap-3 py-2.5 px-3 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none border-none rounded-lg text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <FileText className="h-4 w-4" />
                e-CF / NCF
              </TabsTrigger>
            </TabsList>
          </motion.div>

          <div className="flex-1 w-full min-w-0">
            <TabsContent value="business" className="m-0 mt-0 focus-visible:outline-none focus-visible:ring-0">
              <motion.div variants={item} className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-semibold text-foreground border-b pb-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <h2>Información del Negocio</h2>
                </div>
                <BusinessSettings />
              </motion.div>
            </TabsContent>

            <TabsContent value="users" className="m-0 mt-0 focus-visible:outline-none focus-visible:ring-0">
              <motion.div variants={item} className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-semibold text-foreground border-b pb-2">
                  <Users className="h-5 w-5 text-primary" />
                  <h2>Gestión de Usuarios</h2>
                </div>
                <UserSettings />
              </motion.div>
            </TabsContent>

            <TabsContent value="roles" className="m-0 mt-0 focus-visible:outline-none focus-visible:ring-0">
              <motion.div variants={item} className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-semibold text-foreground border-b pb-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <h2>Roles y Permisos</h2>
                </div>
                <RolesSettings />
              </motion.div>
            </TabsContent>

            <TabsContent value="printer" className="m-0 mt-0 focus-visible:outline-none focus-visible:ring-0">
              <motion.div variants={item} className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-semibold text-foreground border-b pb-2">
                  <Printer className="h-5 w-5 text-primary" />
                  <h2>Configuración de Impresora</h2>
                </div>
                <PrinterSettings />
              </motion.div>
            </TabsContent>

            <TabsContent value="backup" className="m-0 mt-0 focus-visible:outline-none focus-visible:ring-0">
              <motion.div variants={item} className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-semibold text-foreground border-b pb-2">
                  <Database className="h-5 w-5 text-primary" />
                  <h2>Copias de Seguridad</h2>
                </div>
                <BackupSettings />
              </motion.div>
            </TabsContent>

            <TabsContent value="ecf" className="m-0 mt-0 focus-visible:outline-none focus-visible:ring-0">
              <motion.div variants={item} className="space-y-4">
                <div className="flex items-center gap-2 text-lg font-semibold text-foreground border-b pb-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <h2>e-CF / Facturación Electrónica</h2>
                </div>
                <NcfSettings />
              </motion.div>
            </TabsContent>
          </div>
        </Tabs>
      </motion.div>
    </div>
  )
}