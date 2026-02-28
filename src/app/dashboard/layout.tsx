"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  TestTube2,
  Settings,
  BookOpen,
  Menu,
  ChevronDown,
  LogOut,
  User,
  CreditCard,
  Key,
  Plus,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut, useSession } from "next-auth/react";
import { toast } from "sonner";
import { HealifyLogo } from "@/components/HealifyLogo";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationCenter } from "@/components/NotificationCenter";
import { SidebarProjectHealth } from "@/components/SidebarProjectHealth";

const navItems = [
  { name: "Dashboard",      href: "/dashboard",          icon: LayoutDashboard },
  { name: "Proyectos",      href: "/dashboard/projects", icon: FolderKanban    },
  { name: "Tests",          href: "/dashboard/tests",    icon: TestTube2       },
  { name: "Configuración",  href: "/dashboard/settings", icon: Settings        },
  { name: "Docs",           href: "/docs",               icon: BookOpen        },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname   = usePathname();
  const router     = useRouter();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" });
    toast.success("Sesión cerrada correctamente");
  };

  const userInitials = session?.user?.name
    ? session.user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "HF";

  return (
    <div className="min-h-screen bg-[#090909] text-[#EDEDED]">

      {/* ── Mobile overlay ─────────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/70 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-56 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0",
        "bg-[#0C0C0C] border-r border-white/[0.07]",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-[var(--border-default)]">
          <HealifyLogo size="sm" showText={true} />
          <span className="ml-auto text-[10px] font-medium text-[var(--text-tertiary)] bg-[var(--bg-card)] px-1.5 py-0.5 rounded font-mono">
            v0.4
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <div className="px-2 py-2">
            <span className="text-[10px] font-medium tracking-widest text-[var(--text-tertiary)] uppercase">
              Navegación
            </span>
          </div>

          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-all duration-150 group",
                  isActive
                    ? "bg-[#1A1A1A] text-[#EDEDED] border-l-2 border-[#5E6AD2]"
                    : "text-[#6B6B6B] hover:text-[#EDEDED] hover:bg-[#151515]"
                )}
              >
                <item.icon className={cn(
                  "w-4 h-4 transition-colors duration-150",
                  isActive ? "text-[#5E6AD2]" : "text-[#6B6B6B] group-hover:text-[#EDEDED]"
                )} />
                <span className="flex-1">{item.name}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#5E6AD2]" />
                )}
              </Link>
            );
          })}

          {/* Quick actions */}
          <div className="pt-4 mt-4 border-t border-[var(--border-default)]">
            <div className="px-2 py-2">
              <span className="text-[10px] font-medium tracking-widest text-[var(--text-tertiary)] uppercase">
                Acciones rápidas
              </span>
            </div>
            <button
              onClick={() => { router.push("/dashboard/projects"); setSidebarOpen(false); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-all duration-150"
            >
              <Plus className="w-4 h-4 text-[var(--text-tertiary)]" />
              <span>Nuevo Proyecto</span>
            </button>
          </div>

          <SidebarProjectHealth />
        </nav>

        {/* User bottom */}
        <div className="p-3 border-t border-[var(--border-default)]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-[var(--bg-hover)] transition-colors duration-150">
                <Avatar className="w-6 h-6">
                  <AvatarImage src={session?.user?.image || ""} />
                  <AvatarFallback className="text-[10px] font-medium"
                    style={{ background: "linear-gradient(135deg,#5E6AD2,#7A84DC)", color: "#090909" }}>
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                    {session?.user?.name || "Usuario"}
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-[#111111] border-white/[0.07]">
              <DropdownMenuLabel className="text-[var(--text-tertiary)] text-xs">Mi Cuenta</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[var(--border-subtle)]" />
              <DropdownMenuItem asChild className="text-[var(--text-secondary)] text-sm focus:bg-[var(--bg-hover)] focus:text-[var(--text-primary)] cursor-pointer">
                <Link href="/dashboard/settings"><User className="w-4 h-4 mr-2 text-[var(--text-tertiary)]" />Perfil</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="text-[var(--text-secondary)] text-sm focus:bg-[var(--bg-hover)] focus:text-[var(--text-primary)] cursor-pointer">
                <Link href="/pricing"><CreditCard className="w-4 h-4 mr-2 text-[var(--text-tertiary)]" />Facturación</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="text-[var(--text-secondary)] text-sm focus:bg-[var(--bg-hover)] focus:text-[var(--text-primary)] cursor-pointer">
                <Link href="/dashboard/settings"><Key className="w-4 h-4 mr-2 text-[var(--text-tertiary)]" />API Keys</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[var(--border-subtle)]" />
              <DropdownMenuItem onClick={handleSignOut}
                className="text-red-400 text-sm focus:bg-white/5 focus:text-red-300 cursor-pointer">
                <LogOut className="w-4 h-4 mr-2" />Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────── */}
      <div className="lg:pl-56">

        {/* Top header */}
        <header className="sticky top-0 z-30 h-14 bg-[#090909] border-b border-white/[0.07]">
          <div className="flex items-center justify-between h-full px-4 lg:px-6">

            {/* Left */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button className="lg:hidden p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                onClick={() => setSidebarOpen(true)}>
                <Menu className="w-5 h-5" />
              </button>

              {/* Mobile logo — visible only when sidebar is hidden */}
              <div className="lg:hidden">
                <HealifyLogo size="sm" showText={true} />
              </div>

              <div className="min-w-0">
                <GlobalSearch />
              </div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-1">
              <NotificationCenter />

              <div className="w-px h-5 bg-[var(--border-default)] mx-1" />

              {/* User avatar */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 p-1 rounded-md hover:bg-[var(--bg-hover)] transition-colors">
                    <Avatar className="w-7 h-7">
                      <AvatarImage src={session?.user?.image || ""} />
                      <AvatarFallback className="text-[10px] font-medium"
                        style={{ background: "linear-gradient(135deg,#5E6AD2,#7A84DC)", color: "#090909" }}>
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-[#111111] border-white/[0.07]">
                  <DropdownMenuItem asChild className="text-[var(--text-secondary)] text-sm focus:bg-[var(--bg-hover)] focus:text-[var(--text-primary)] cursor-pointer">
                    <Link href="/dashboard/settings"><User className="w-4 h-4 mr-2 text-[var(--text-tertiary)]" />Perfil</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-[var(--border-subtle)]" />
                  <DropdownMenuItem onClick={handleSignOut}
                    className="text-red-400 text-sm focus:bg-white/5 focus:text-red-300 cursor-pointer">
                    <LogOut className="w-4 h-4 mr-2" />Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6 min-h-[calc(100vh-3.5rem)] pb-safe">
          {children}
        </main>
      </div>
    </div>
  );
}
