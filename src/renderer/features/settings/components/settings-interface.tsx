import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import {
  Building2,
  Database,
  History,
  Info,
  Landmark,
  LucideIcon,
  Printer,
  ShieldCheck,
  SunMoon,
  Users,
} from "lucide-react";
import { BusinessSettings } from "./business-settings";
import { FiscalSettings } from "./fiscal-settings";
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
  | "fiscal"
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
  description: string;
  icon: LucideIcon;
  content: () => ReactNode;
}

const SECTIONS: Section[] = [
  {
    id: "business",
    label: "Negocio",
    description: "Identidad, contacto y datos que aparecen en tus recibos",
    icon: Building2,
    content: () => <BusinessSettings />,
  },
  {
    id: "fiscal",
    label: "Fiscal",
    description: "Comprobantes fiscales (NCF), ITBIS y secuencias de la DGII",
    icon: Landmark,
    content: () => <FiscalSettings />,
  },
  {
    id: "appearance",
    label: "Apariencia",
    description: "Tema claro, oscuro o del sistema, y escala de la interfaz",
    icon: SunMoon,
    content: () => <AppearanceSettings />,
  },
  {
    id: "users",
    label: "Usuarios",
    description: "Cuentas que pueden iniciar sesión en este punto de venta",
    icon: Users,
    content: () => <UserSettings />,
  },
  {
    id: "roles",
    label: "Roles y Permisos",
    description: "Qué puede hacer cada tipo de usuario",
    icon: ShieldCheck,
    content: () => <RolesSettings />,
  },
  {
    id: "printer",
    label: "Impresora",
    description: "Impresora de recibos, tamaño de papel y mensaje del ticket",
    icon: Printer,
    content: () => <PrinterSettings />,
  },
  {
    id: "backup",
    label: "Copias de Seguridad",
    description: "Respaldo automático y restauración de la base de datos",
    icon: Database,
    content: () => <BackupSettings />,
  },
  {
    id: "activity",
    label: "Actividad",
    description: "Registro de acciones sensibles realizadas por los usuarios",
    icon: History,
    content: () => <ActivitySettings />,
  },
  {
    id: "about",
    label: "Acerca de",
    description: "Versión, licencia e información del sistema",
    icon: Info,
    content: () => <AboutSettings />,
  },
];

const LAST_SECTION_KEY = "settings:last-section";

function readLastSection(): SectionId | null {
  try {
    return window.sessionStorage.getItem(LAST_SECTION_KEY) as SectionId | null;
  } catch {
    return null;
  }
}

function writeLastSection(id: SectionId) {
  try {
    window.sessionStorage.setItem(LAST_SECTION_KEY, id);
  } catch {
    // sessionStorage no disponible: la persistencia es una comodidad, no un requisito.
  }
}

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
      fiscal: perms["settings:view"],
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

  const location = useLocation();
  const requestedSection = (location.state as { tab?: SectionId } | null)?.tab;
  // HIG › Settings: "Restore the most recently viewed pane". Una petición
  // explícita (location.state) siempre gana sobre la última sección visitada.
  const [activeId, setActiveId] = useState<SectionId>(() => {
    const remembered = readLastSection();
    const isVisible = (id: SectionId | null | undefined) =>
      !!id && visibleSections.some((s) => s.id === id);
    if (isVisible(requestedSection)) return requestedSection as SectionId;
    if (isVisible(remembered)) return remembered as SectionId;
    return visibleSections[0]?.id ?? "appearance";
  });

  const active =
    visibleSections.find((s) => s.id === activeId) ?? visibleSections[0];

  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const selectSection = (id: SectionId) => {
    setActiveId(id);
    writeLastSection(id);
  };

  // Navegación por teclado estándar de un tablist (flechas, Inicio, Fin).
  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const count = visibleSections.length;
    let nextIndex: number | null = null;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        nextIndex = (index + 1) % count;
        break;
      case "ArrowUp":
      case "ArrowLeft":
        nextIndex = (index - 1 + count) % count;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = count - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const next = visibleSections[nextIndex];
    if (!next) return;
    selectSection(next.id);
    tabRefs.current[next.id]?.focus();
  };

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="Ajustes"
        description="Configura las preferencias y parámetros del sistema"
      />

      <div className="flex flex-col md:flex-row gap-6 items-start">
        {/* Section nav — sticky on the left, Vercel style */}
        <nav
          aria-label="Secciones de ajustes"
          className="w-full md:w-52 shrink-0 md:sticky md:top-6 overflow-x-auto md:overflow-visible"
        >
          <div
            role="tablist"
            aria-orientation="vertical"
            className="flex md:flex-col gap-1"
          >
            {visibleSections.map((section, index) => {
              const isActive = active?.id === section.id;
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  ref={(el) => {
                    tabRefs.current[section.id] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`settings-tab-${section.id}`}
                  aria-selected={isActive}
                  aria-controls={`settings-panel-${section.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => selectSection(section.id)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-left whitespace-nowrap transition-colors shrink-0 md:shrink md:w-full cursor-pointer",
                    "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isActive
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  )}
                >
                  <Icon
                    className={cn("h-4 w-4 shrink-0", !isActive && "text-muted-foreground")}
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  {section.label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Active section content */}
        {active && (
          <section
            key={active.id}
            role="tabpanel"
            id={`settings-panel-${active.id}`}
            aria-labelledby={`settings-tab-${active.id}`}
            tabIndex={-1}
            className="flex-1 min-w-0 w-full space-y-6 outline-none"
          >
            <div className="space-y-1">
              <h2 className="text-xl font-semibold tracking-tight">{active.label}</h2>
              <p className="text-sm text-muted-foreground">{active.description}</p>
            </div>
            {active.content()}
          </section>
        )}
      </div>
    </div>
  );
}
