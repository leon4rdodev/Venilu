import { useMemo, useState, type ReactNode } from "react";
import {
  Building2,
  Database,
  History,
  Info,
  LucideIcon,
  Printer,
  ShieldCheck,
  SunMoon,
  Users,
} from "lucide-react";
import { BusinessSettings } from "./business-settings";
import { AppearanceSettings } from "./appearance-settings";
import { UserSettings } from "./user-settings";
import { RolesSettings } from "./roles-settings";
import { PrinterSettings } from "./printer-settings";
import { BackupSettings } from "./backup-settings";
import { ActivitySettings } from "./activity-settings";
import { AboutSettings } from "./about-settings";
import { PageHeader } from "@renderer/shared/components/page-header";
import { usePermissions } from "@renderer/features/auth/hooks/use-permission";
import { cn } from "@lib/utils";

type SectionId =
  | "business"
  | "appearance"
  | "users"
  | "roles"
  | "printer"
  | "backup"
  | "activity"
  | "about";

interface Section {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  content: () => ReactNode;
}

const SECTIONS: Section[] = [
  { id: "business", label: "Negocio", icon: Building2, content: () => <BusinessSettings /> },
  { id: "appearance", label: "Apariencia", icon: SunMoon, content: () => <AppearanceSettings /> },
  { id: "users", label: "Usuarios", icon: Users, content: () => <UserSettings /> },
  { id: "roles", label: "Roles y Permisos", icon: ShieldCheck, content: () => <RolesSettings /> },
  { id: "printer", label: "Impresora", icon: Printer, content: () => <PrinterSettings /> },
  { id: "backup", label: "Copias de Seguridad", icon: Database, content: () => <BackupSettings /> },
  { id: "activity", label: "Actividad", icon: History, content: () => <ActivitySettings /> },
  { id: "about", label: "Acerca de", icon: Info, content: () => <AboutSettings /> },
];

export function SettingsInterface() {
  const perms = usePermissions(
    "settings:view",
    "users:view",
    "users:roles",
    "settings:printer",
    "backups:manage",
    "audit:view",
  );

  // Which sections the current user can see. Appearance and About are open to
  // everyone who can reach this page (the sidebar already gates on settings:view).
  const visibleSections = useMemo(() => {
    const allowed: Record<SectionId, boolean> = {
      business: perms["settings:view"],
      appearance: true,
      users: perms["users:view"],
      roles: perms["users:roles"],
      printer: perms["settings:printer"],
      backup: perms["backups:manage"],
      activity: perms["audit:view"],
      about: true,
    };
    return SECTIONS.filter((s) => allowed[s.id]);
  }, [perms]);

  const [activeId, setActiveId] = useState<SectionId>(
    () => visibleSections[0]?.id ?? "appearance",
  );

  const active =
    visibleSections.find((s) => s.id === activeId) ?? visibleSections[0];

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Ajustes"
        description="Configura las preferencias y parámetros del sistema"
      />

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Section nav — sticky on the left, Vercel style */}
        <nav className="w-full md:w-52 shrink-0 md:sticky md:top-6 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
          {visibleSections.map((section) => {
            const isActive = active?.id === section.id;
            const Icon = section.icon;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveId(section.id)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-left whitespace-nowrap transition-colors shrink-0 md:shrink md:w-full",
                  isActive
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                {section.label}
              </button>
            );
          })}
        </nav>

        {/* Active section content */}
        <div className="flex-1 min-w-0 w-full space-y-6">
          {active?.content()}
        </div>
      </div>
    </div>
  );
}
