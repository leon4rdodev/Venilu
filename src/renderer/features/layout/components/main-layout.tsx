import { useEffect, useRef } from "react"
import { Sidebar, Header } from "@renderer/features/layout"
import { useUser } from "@renderer/features/auth"
import { Outlet, useLocation } from "react-router-dom"

/**
 * Vercel-style app shell: full-width 64px top bar, 64px icon rail below it,
 * content canvas to the right. Never blocked by data loading — the shift chip
 * simply appears in the header when its data arrives.
 */
export function MainLayout() {
  const { user } = useUser();
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // The <main> element persists across navigations, so without this the new
  // page would inherit the previous page's scroll position (visible "jump").
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  const role = user?.role_entity?.name || user?.role || null;
  const name = user?.name || null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Header userName={name} userRole={role} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden ml-16 p-5">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
