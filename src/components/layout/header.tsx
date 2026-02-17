import { useState, useMemo } from "react"
import { LogOut, Sun, Moon } from "lucide-react"
import { useTheme } from "@/hooks/use-theme"
import { CloseShiftDialog } from "../pos/close-shift-dialog"
import { useShift } from "@/hooks/use-shift"
import { useUser } from "@/hooks/use-user"
import { formatCurrency } from "@/lib/currency"

interface HeaderProps {
  userName: string | null;
  userRole: string | null;
}

export function Header({ userName, userRole }: HeaderProps) {
  const { theme, setTheme } = useTheme()
  const { activeShift, shiftSales } = useShift();
  const { logout } = useUser();
  const [isCloseShiftDialogOpen, setCloseShiftDialogOpen] = useState(false);

  const currentCashInDrawer = useMemo(() => {
    if (!activeShift) return 0;
    const cashSalesTotal = shiftSales
      .filter(sale => sale.payment_method === 'cash')
      .reduce((sum, sale) => sum + sale.total_amount, 0);
    return activeShift.initial_cash + cashSalesTotal;
  }, [activeShift, shiftSales]);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  return (
    <>
      <header className="sticky top-0 z-30 grid grid-cols-[1fr_auto_1fr] h-16 items-center border-b bg-card/95 backdrop-blur px-6">
        {/* Left Section */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 rounded-full border bg-card/80 backdrop-blur-sm px-4 py-2 shadow-sm">
            <span className="text-sm font-semibold whitespace-nowrap">
              {userName || 'Invitado'}
            </span>
            {userRole && (
              <>
                <span className="h-4 w-px bg-border" />
                <span className="text-xs text-muted-foreground capitalize">{userRole}</span>
              </>
            )}
          </div>
        </div>

        {/* Center Section - Shift Indicator (perfectly centered via grid) */}
        <div className="flex items-center justify-center">
          {activeShift && (
            <button
              onClick={() => setCloseShiftDialogOpen(true)}
              className="flex items-center gap-3 rounded-full border bg-card/80 backdrop-blur-sm pl-3 pr-4 py-2 hover:bg-muted/60 transition-all duration-200 shadow-sm"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
              </span>
              <span className="text-sm text-muted-foreground">Caja abierta</span>
              <span className="h-4 w-px bg-border" />
              <span className="text-sm font-semibold tabular-nums">{formatCurrency(currentCashInDrawer)}</span>
            </button>
          )}
        </div>

        {/* Right Section */}
        <div className="flex items-center justify-end gap-1.5">
          <div className="flex items-center rounded-full border bg-card/80 backdrop-blur-sm shadow-sm">
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center h-9 w-9 rounded-full hover:bg-muted/60 transition-colors"
            >
              {theme === "dark" ? (
                <Moon className="h-4 w-4" />
              ) : (
                <Sun className="h-4 w-4" />
              )}
              <span className="sr-only">Cambiar tema</span>
            </button>
            <span className="h-4 w-px bg-border" />
            <button
              onClick={logout}
              className="flex items-center justify-center h-9 w-9 rounded-full text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Cerrar sesión</span>
            </button>
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