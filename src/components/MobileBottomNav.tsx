"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  FolderKanban,
  TestTube2,
  Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Proyectos", href: "/dashboard/projects", icon: FolderKanban },
  { name: "Tests", href: "/dashboard/tests", icon: TestTube2 },
  { name: "Ajustes", href: "/dashboard/settings", icon: Settings },
]

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden border-t border-white/[0.06] bg-[#000000]/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="grid grid-cols-4 h-14">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href ||
            (tab.href !== "/dashboard" && pathname.startsWith(tab.href))

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors",
                isActive
                  ? "text-white"
                  : "text-[#6B6B6B] active:text-white/70"
              )}
            >
              <tab.icon
                className={cn(
                  "w-5 h-5 transition-colors",
                  isActive ? "text-white" : "text-[#6B6B6B]"
                )}
              />
              <span>{tab.name}</span>
              {isActive && (
                <span className="absolute top-0 w-8 h-0.5 rounded-full bg-white" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
