import { Sidebar, Header, useSidebar } from "@renderer/features/layout"
import { useUser } from "@renderer/features/auth"
import { useShift, OpenShiftDialog } from "@renderer/features/pos"
import { Spinner } from "@components/ui/spinner"
import { Outlet, useLocation, Navigate } from "react-router-dom"
import { cn } from "@lib/utils"

export default function MainLayout() {
  const { collapsed } = useSidebar()
  const { user } = useUser();
  const { activeShift, isLoading: isShiftLoading } = useShift();
  const location = useLocation();

  const role = user?.role || null;
  const name = user?.name || null;

  if (isShiftLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Spinner size="large" />
      </div>
    );
  }

  // Business logic: Ensure shift is open for non-admins
  if (!activeShift && role !== 'admin') {
    return <OpenShiftDialog isOpen={true} />;
  }

  // Business logic: Employee restriction to POS
  if (role === 'employee' && location.pathname !== '/pos') {
    return <Navigate to="/pos" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar userRole={role} />
      
      <div className={cn(
        "flex-1 flex flex-col transition-all duration-200 ease-in-out", 
        collapsed ? "ml-16" : "ml-64"
      )}>
        <Header userName={name} userRole={role} />
        
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
