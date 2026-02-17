import { Sidebar } from "@components/layout/sidebar"
import { Header } from "@components/layout/header"
import { useSidebar } from "@hooks/use-sidebar"
import { cn } from "@lib/utils"
import { useUser } from "@hooks/use-user"
import { Outlet, useLocation, Navigate } from "react-router-dom"
import { useShift } from "./hooks/use-shift"
import { OpenShiftDialog } from "./components/pos/open-shift-dialog"
import { Spinner } from "./components/ui/spinner"

export default function MainLayout() {
  const { collapsed } = useSidebar()
  const { user } = useUser();
  const name = user?.name || null;
  const role = user?.role || null;
  const { activeShift, isLoading: isShiftLoading } = useShift();
  const location = useLocation();

  if (isShiftLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Spinner size="large" />
      </div>
    );
  }

  if (!activeShift && role !== 'admin') {
    return <OpenShiftDialog isOpen={true} />;
  }

  // Redirect vendedor to POS if they are not on the POS page
  if (role === 'employee' && location.pathname !== '/pos') {
    return <Navigate to="/pos" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar userRole={role} />
      <div className={cn("flex-1 flex flex-col transition-all duration-200 ease-in-out", collapsed ? "ml-16" : "ml-64")}>
        <Header userName={name} userRole={role} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
