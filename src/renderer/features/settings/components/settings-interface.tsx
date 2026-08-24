import { Building2, Users, Printer, Database, ShieldCheck } from "lucide-react"
import { BusinessSettings } from "./business-settings"
import { UserSettings } from "./user-settings"
import { PrinterSettings } from "./printer-settings"
import { BackupSettings } from "./backup-settings"
import { RolesSettings } from "./roles-settings"
import { PageHeader } from "@renderer/shared/components/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@components/ui/tabs"

const TAB_TRIGGER_CLASS =
  "flex-none rounded-none border-0 border-b-2 border-transparent bg-transparent px-1 pt-1 pb-3 text-sm font-medium text-muted-foreground gap-2 shadow-none transition-colors hover:text-foreground data-[state=active]:border-foreground data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none dark:data-[state=active]:border-foreground dark:data-[state=active]:bg-transparent"

export function SettingsInterface() {
  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Ajustes"
        description="Configura las preferencias y parámetros del sistema"
      />

      {/* Page entrance is handled by AnimatedPage — no extra animation layers */}
      <Tabs defaultValue="business" className="flex flex-col gap-6">
        <TabsList className="w-full h-auto justify-start bg-transparent p-0 gap-6 rounded-none border-b border-border overflow-x-auto">
          <TabsTrigger value="business" className={TAB_TRIGGER_CLASS}>
            <Building2 className="h-4 w-4" strokeWidth={1.75} />
            Negocio
          </TabsTrigger>
          <TabsTrigger value="users" className={TAB_TRIGGER_CLASS}>
            <Users className="h-4 w-4" strokeWidth={1.75} />
            Usuarios
          </TabsTrigger>
          <TabsTrigger value="roles" className={TAB_TRIGGER_CLASS}>
            <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
            Roles y Permisos
          </TabsTrigger>
          <TabsTrigger value="printer" className={TAB_TRIGGER_CLASS}>
            <Printer className="h-4 w-4" strokeWidth={1.75} />
            Impresora
          </TabsTrigger>
          <TabsTrigger value="backup" className={TAB_TRIGGER_CLASS}>
            <Database className="h-4 w-4" strokeWidth={1.75} />
            Copias de Seguridad
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 w-full min-w-0">
          <TabsContent value="business" className="m-0 mt-0 focus-visible:outline-none focus-visible:ring-0">
            <BusinessSettings />
          </TabsContent>

          <TabsContent value="users" className="m-0 mt-0 focus-visible:outline-none focus-visible:ring-0">
            <UserSettings />
          </TabsContent>

          <TabsContent value="roles" className="m-0 mt-0 focus-visible:outline-none focus-visible:ring-0">
            <RolesSettings />
          </TabsContent>

          <TabsContent value="printer" className="m-0 mt-0 focus-visible:outline-none focus-visible:ring-0">
            <PrinterSettings />
          </TabsContent>

          <TabsContent value="backup" className="m-0 mt-0 focus-visible:outline-none focus-visible:ring-0">
            <BackupSettings />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
