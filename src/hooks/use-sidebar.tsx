import { create } from "zustand"
import { persist } from "zustand/middleware"

interface SidebarState {
  collapsed: boolean
  isToggling: boolean
  toggleCollapsed: () => void
  setCollapsed: (collapsed: boolean) => void
}

let timeoutId: NodeJS.Timeout | null = null

export const useSidebar = create<SidebarState>()(
  persist(
    (set) => ({
      collapsed: true,
      isToggling: false,
      toggleCollapsed: () =>
        set((state) => {
          if (timeoutId) {
            clearTimeout(timeoutId)
          }

          timeoutId = setTimeout(() => {
            set({ isToggling: false })
            timeoutId = null
          }, 150) // Corresponds to the animation duration

          return { collapsed: !state.collapsed, isToggling: true }
        }),
      setCollapsed: (collapsed) => set({ collapsed, isToggling: false }),
    }),
    {
      name: "sidebar-storage",
    },
  ),
)
