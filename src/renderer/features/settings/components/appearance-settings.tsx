import { Check } from "lucide-react";
import { useTheme } from "@hooks/use-theme";
import { cn } from "@lib/utils";

type ThemeOption = "light" | "dark" | "system";

const OPTIONS: { value: ThemeOption; label: string; description: string }[] = [
  { value: "light", label: "Claro", description: "Fondo claro, texto oscuro" },
  { value: "dark", label: "Oscuro", description: "Fondo oscuro, texto claro" },
  { value: "system", label: "Sistema", description: "Sigue el tema del equipo" },
];

/** Mini window mock-up rendered with plain divs (no images). Decorativo. */
function ThemePreview({ variant }: { variant: ThemeOption }) {
  if (variant === "system") {
    return (
      <div aria-hidden="true" className="h-20 rounded-md border border-border overflow-hidden flex">
        <div className="flex-1 bg-white p-2 space-y-1.5">
          <div className="h-1.5 w-8 rounded-full bg-zinc-300" />
          <div className="h-1.5 w-12 rounded-full bg-zinc-200" />
          <div className="h-5 rounded-sm bg-zinc-100 border border-zinc-200" />
        </div>
        <div className="flex-1 bg-zinc-950 p-2 space-y-1.5">
          <div className="h-1.5 w-8 rounded-full bg-zinc-600" />
          <div className="h-1.5 w-12 rounded-full bg-zinc-700" />
          <div className="h-5 rounded-sm bg-zinc-900 border border-zinc-800" />
        </div>
      </div>
    );
  }

  const isDark = variant === "dark";
  return (
    <div
      aria-hidden="true"
      className={cn(
        "h-20 rounded-md border border-border overflow-hidden p-2 space-y-1.5",
        isDark ? "bg-zinc-950" : "bg-white"
      )}
    >
      <div className={cn("h-1.5 w-10 rounded-full", isDark ? "bg-zinc-600" : "bg-zinc-300")} />
      <div className={cn("h-1.5 w-16 rounded-full", isDark ? "bg-zinc-700" : "bg-zinc-200")} />
      <div
        className={cn(
          "h-8 rounded-sm border",
          isDark ? "bg-zinc-900 border-zinc-800" : "bg-zinc-100 border-zinc-200"
        )}
      />
    </div>
  );
}

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="space-y-1">
        <h3 id="theme-group-label" className="text-sm font-medium">
          Tema
        </h3>
        <p id="theme-group-description" className="text-sm text-muted-foreground">
          Personaliza el aspecto de la aplicación. «Sistema» respeta la preferencia de tu equipo.
        </p>
      </div>

      {/* Opción excluyente → semántica de grupo de radios (HIG › Accesibilidad). */}
      <div
        role="radiogroup"
        aria-labelledby="theme-group-label"
        aria-describedby="theme-group-description"
        className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {OPTIONS.map((option) => {
          const isActive = theme === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => setTheme(option.value)}
              className={cn(
                "relative rounded-lg border p-3 text-left transition-colors cursor-pointer",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isActive
                  ? "border-foreground bg-muted/40"
                  : "border-border hover:border-muted-foreground/40 hover:bg-muted/20"
              )}
            >
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background"
                >
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                </span>
              )}
              <ThemePreview variant={option.value} />
              <p className="mt-3 text-sm font-medium">{option.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
