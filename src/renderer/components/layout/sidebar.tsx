import { useMemo } from "react";
import { cn } from "@lib/utils";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  BarChart,
  Settings,
  Smartphone,
} from "lucide-react";

type NavItem = {
  to: string;
  icon: any;
  label: string;
};

const navItems: NavItem[] = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Inicio" },
  { to: "/pos", icon: ShoppingCart, label: "Punto de Venta" },
  { to: "/inventory", icon: Package, label: "Inventario" },
  { to: "/reports", icon: BarChart, label: "Reportes" },
  { to: "/settings", icon: Settings, label: "Ajustes" },
];

export function Sidebar({ userRole }: { userRole: string | null }) {
  const { pathname } = useLocation();

  const visibleNavItems = useMemo(() => {
    if (userRole === 'employee') {
      return navItems.filter(item => item.to === '/pos');
    }
    return navItems;
  }, [userRole]);

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-16 border-r border-border bg-background">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 shrink-0 items-center justify-center border-b border-border">
          <Link to="/dashboard" className="group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary group-hover:scale-105 transition-transform">
              <Smartphone className="h-5 w-5 text-primary-foreground" />
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          <div className="flex flex-col items-center space-y-2">
            {visibleNavItems.map((item) => {
              const isActive = pathname === item.to;
              return (
                <Link key={item.to} to={item.to}>
                  <div
                    className={cn(
                      "group flex h-10 w-10 items-center justify-center rounded-md transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground/70 hover:bg-muted hover:text-foreground"
                    )}
                    title={item.label}
                  >
                    <item.icon className="h-5 w-5" />
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </aside>
  );
}