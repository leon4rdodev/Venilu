import { useState, useMemo } from "react"
import { LogOut, Sun, Moon, ChevronRight } from "lucide-react"
import { useTheme } from "@hooks/use-theme"
import { CloseShiftDialog, useShift } from "@renderer/features/pos"
import { useUser } from "@renderer/features/auth"
import { formatCurrency } from "@lib/currency"

interface HeaderProps {
  userName: string | null;
  userRole: string | null;
}

/**
 * Vercel-style top navigation: brand + breadcrumb-like shift chip on the left,
 * round icon buttons + user pill on the right. Full-width, hairline border,
 * no shadows.
 */
export function Header({ userName, userRole }: HeaderProps) {
  const { theme, setTheme } = useTheme()
  const { activeShift, shiftSales, shiftDebtPayments, shiftExpenses } = useShift();
  const { logout } = useUser();
  const [isCloseShiftDialogOpen, setCloseShiftDialogOpen] = useState(false);

  const currentCashInDrawer = useMemo(() => {
    if (!activeShift) return 0;
    const activeSales = shiftSales.filter(s => s.status !== 'voided');
    const cashSalesTotal = activeSales
      .filter(sale => sale.payment_method === 'cash')
      .reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0);
    const cashDebtTotal = (shiftDebtPayments || [])
      .filter(p => p.payment_method === 'cash')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalExpenses = (shiftExpenses || [])
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    return Number(activeShift.initial_cash || 0) + cashSalesTotal + cashDebtTotal - totalExpenses;
  }, [activeShift, shiftSales, shiftDebtPayments, shiftExpenses]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  const initial = (userName || "?").charAt(0).toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-background px-5">
        {/* Left: brand + shift status chip */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-xl font-bold tracking-tight select-none">Venilu</span>

          {activeShift && (
            <>
              <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" strokeWidth={1.75} />
              <button
                onClick={() => setCloseShiftDialogOpen(true)}
                title="Ver / cerrar turno"
                className="flex items-center gap-2 rounded-full border border-border pl-1.5 pr-3 py-1 hover:bg-muted transition-colors min-w-0"
              >
                <span className="flex h-6 w-6 items-center justify-center shrink-0">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                </span>
                <div className="flex items-baseline gap-1.5 text-sm min-w-0">
                  <span className="font-medium whitespace-nowrap">Caja abierta</span>
                  <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {formatCurrency(currentCashInDrawer)}
                  </span>
                </div>
              </button>
            </>
          )}
        </div>

        {/* Right: icon buttons + user pill */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={toggleTheme}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            {theme === "dark" ? (
              <Moon className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <Sun className="h-4 w-4" strokeWidth={1.75} />
            )}
            <span className="sr-only">Cambiar tema</span>
          </button>

          <button
            onClick={logout}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
            <span className="sr-only">Cerrar sesión</span>
          </button>

          <div className="flex items-center gap-2 rounded-full border border-border pl-1.5 pr-3 py-1">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold select-none">
              {initial}
            </div>
            <div className="hidden sm:flex items-baseline gap-1.5 text-sm min-w-0">
              <span className="font-medium truncate">{userName || "Invitado"}</span>
              {userRole && (
                <span className="text-xs text-muted-foreground capitalize truncate">{userRole}</span>
              )}
            </div>
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
