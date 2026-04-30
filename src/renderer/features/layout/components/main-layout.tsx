import { Sidebar, Header, useSidebar } from "@renderer/features/layout"
import { useUser } from "@renderer/features/auth"
import { useShift } from "@renderer/features/pos"
import { Spinner } from "@components/ui/spinner"
import { Outlet } from "react-router-dom"
import { cn } from "@lib/utils"

export function MainLayout() {
  const { collapsed } = useSidebar()
  const { user } = useUser();
  const { isLoading: isShiftLoading } = useShift();

  const role = user?.role || null;
  const name = user?.name || null;

  if (isShiftLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Spinner size="large" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      
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
