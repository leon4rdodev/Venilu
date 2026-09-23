import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { LogOut, Sun, Moon, ChevronRight, Lock, KeyRound } from "lucide-react"
import { useTheme } from "@hooks/use-theme"
import { CloseShiftDialog, useShift } from "@renderer/features/pos"
import { useUser } from "@renderer/features/auth"
import { useLock } from "@renderer/features/lock"
import { useLicense } from "@renderer/features/license"
import { formatCurrency } from "@lib/currency"
import { computeShiftCash } from "@shared/cash-reconciliation"

interface HeaderProps {
  userName: string | null;
  userRole: string | null;
}

// Round hairline icon button (36px target) shared by the header controls.
const ICON_BUTTON =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

// Pill chip (36px tall) used for status/navigation chips.
const CHIP =
  "flex h-9 items-center rounded-full border border-border transition-colors hover:bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * Vercel-style top navigation: brand + breadcrumb-like shift chip on the left,
 * round icon buttons (lock, theme, logout) + user identity chip on the right.
 * Full-width, hairline border, no shadows.
 */
export function Header({ userName, userRole }: HeaderProps) {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const { activeShift, shiftSales, shiftDebtPayments, shiftExpenses, shiftReturns } = useShift();
  const { logout } = useUser();
  const { lock } = useLock();
  const { status: licenseStatus } = useLicense();
  const [isCloseShiftDialogOpen, setCloseShiftDialogOpen] = useState(false);

  // License chip: trial countdown, or annual-renewal warning within 30 days.
  const licenseChip = useMemo(() => {
    if (!licenseStatus) return null;
    if (licenseStatus.state === "trial" && typeof licenseStatus.trialDaysLeft === "number") {
      return { kind: "trial" as const, days: licenseStatus.trialDaysLeft };
    }
    if (
      licenseStatus.state === "active" &&
      licenseStatus.license?.type === "anual" &&
      typeof licenseStatus.daysToExpiry === "number" &&
      licenseStatus.daysToExpiry <= 30
    ) {
      return { kind: "renewal" as const, days: licenseStatus.daysToExpiry };
    }
    return null;
  }, [licenseStatus]);

  // Same formula as the backend arqueo (@shared/cash-reconciliation):
  // fondo + ventas efectivo + abonos − reembolsos − gastos − devoluciones.
  const currentCashInDrawer = useMemo(() => {
    if (!activeShift) return 0;
    return computeShiftCash({
      initialCash: activeShift.initial_cash,
      sales: shiftSales,
      debtPayments: shiftDebtPayments || [],
      expenses: shiftExpenses || [],
      returns: shiftReturns || [],
    }).expectedCash;
  }, [activeShift, shiftSales, shiftDebtPayments, shiftExpenses, shiftReturns]);

  const isDark = theme === "dark";
  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark")
  }
  const themeLabel = isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro";

  const initial = (userName || "?").charAt(0).toUpperCase();
  const displayName = userName || "Invitado";
  const daysLabel = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;
  const licenseUrgent = licenseChip !== null && licenseChip.days <= 5;

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-border bg-background px-5">
        {/* Left: brand + shift status chip */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl font-bold tracking-tight select-none">Venilu</span>

          {activeShift && (
            <>
              <ChevronRight
                className="h-4 w-4 text-muted-foreground/60 shrink-0"
                strokeWidth={1.75}
                aria-hidden
              />
              <button
                type="button"
                onClick={() => setCloseShiftDialogOpen(true)}
                title="Ver o cerrar turno"
                aria-label={`Caja abierta, ${formatCurrency(currentCashInDrawer)} en caja. Ver o cerrar turno`}
                className={`${CHIP} gap-2 pl-1.5 pr-3 min-w-0`}
              >
                <span className="flex h-6 w-6 items-center justify-center shrink-0" aria-hidden>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping motion-reduce:animate-none rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                </span>
                <span className="flex items-baseline gap-1.5 text-sm min-w-0">
                  <span className="font-medium whitespace-nowrap">Caja abierta</span>
                  <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {formatCurrency(currentCashInDrawer)}
                  </span>
                </span>
              </button>
            </>
          )}
        </div>

        {/* Right: license chip + icon buttons + user identity */}
        <div className="flex items-center gap-2.5 shrink-0">
          {licenseChip && (
            <button
              type="button"
              onClick={() => navigate("/settings", { state: { tab: "about" } })}
              title="Ver licencia en Ajustes"
              className={`${CHIP} hidden md:flex gap-1.5 pl-2.5 pr-3 text-xs whitespace-nowrap`}
            >
              <KeyRound
                className={
                  licenseUrgent
                    ? "h-3.5 w-3.5 text-amber-600 dark:text-amber-400"
                    : "h-3.5 w-3.5 text-muted-foreground"
                }
                strokeWidth={1.75}
                aria-hidden
              />
              {licenseChip.kind === "trial" ? (
                <>
                  <span className="text-muted-foreground">Prueba ·</span>
                  <span
                    className={
                      licenseUrgent
                        ? "font-medium tabular-nums text-amber-600 dark:text-amber-400"
                        : "font-medium tabular-nums text-foreground"
                    }
                  >
                    {daysLabel(licenseChip.days)}
                  </span>
                </>
              ) : (
                <span className="font-medium tabular-nums text-amber-600 dark:text-amber-400">
                  Licencia vence en {daysLabel(licenseChip.days)}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={lock}
            title="Bloquear caja (Ctrl+L)"
            aria-label="Bloquear caja"
            aria-keyshortcuts="Control+L"
            className={ICON_BUTTON}
          >
            <Lock className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            title={themeLabel}
            aria-label={themeLabel}
            className={ICON_BUTTON}
          >
            {isDark ? (
              <Moon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            ) : (
              <Sun className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            )}
          </button>

          <button
            type="button"
            onClick={() => void logout()}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className={`${ICON_BUTTON} hover:text-destructive hover:border-destructive/40`}
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </button>

          {/* User identity: avatar + name + role (display only) */}
          <div
            className={`${CHIP} gap-2 pl-1.5 pr-3`}
            title={userRole ? `${displayName} · ${userRole}` : displayName}
          >
            <span
              aria-hidden
              className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold select-none"
            >
              {initial}
            </span>
            <span className="hidden sm:flex items-baseline gap-1.5 text-sm min-w-0 max-w-[14rem]">
              <span className="font-medium truncate">{displayName}</span>
              {userRole && (
                <span className="text-xs text-muted-foreground capitalize truncate">{userRole}</span>
              )}
            </span>
          </div>
        </div>
      </header>

      <CloseShiftDialog
        isOpen={isCloseShiftDialogOpen}
        onClose={() => setCloseShiftDialogOpen(false)}
      />
    </>
  )
}
