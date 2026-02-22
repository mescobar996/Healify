"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  TestTube2,
  Settings,
  Menu,
  Bell,
  Search,
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

const navItems = [
  { name: "Dashboard",      href: "/dashboard",          icon: LayoutDashboard },
  { name: "Proyectos",      href: "/dashboard/projects", icon: FolderKanban    },
  { name: "Tests",          href: "/dashboard/tests",    icon: TestTube2       },
  { name: "Configuración",  href: "/dashboard/settings", icon: Settings        },
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
    <div className="min-h-screen bg-[#0A0E1A] text-[#E8F0FF]">

      {/* ── Mobile overlay ─────────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-56 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0",
        "bg-[rgba(10,14,26,0.85)] backdrop-blur-xl border-r border-white/8",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-white/8">
          <HealifyLogo size="sm" showText={true} />
          <span className="ml-auto text-[10px] font-medium text-[#E8F0FF]/30 bg-white/5 px-1.5 py-0.5 rounded font-mono">
            v0.4
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <div className="px-2 py-2">
            <span className="text-[10px] font-medium tracking-widest text-[#E8F0FF]/30 uppercase">
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
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 group",
                  isActive
                    ? "bg-[rgba(0,245,200,0.08)] text-[#00F5C8] border border-[#00F5C8]/20"
                    : "text-[#E8F0FF]/50 hover:text-[#E8F0FF] hover:bg-white/5"
                )}
              >
                <item.icon className={cn(
                  "w-4 h-4 transition-colors duration-150",
                  isActive ? "text-[#00F5C8]" : "text-[#E8F0FF]/30 group-hover:text-[#E8F0FF]/70"
                )} />
                <span className="flex-1">{item.name}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00F5C8]" />
                )}
              </Link>
            );
          })}

          {/* Quick actions */}
          <div className="pt-4 mt-4 border-t border-white/8">
            <div className="px-2 py-2">
              <span className="text-[10px] font-medium tracking-widest text-[#E8F0FF]/30 uppercase">
                Acciones rápidas
              </span>
            </div>
            <button
              onClick={() => { router.push("/dashboard/projects"); setSidebarOpen(false); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] font-medium text-[#E8F0FF]/50 hover:text-[#E8F0FF] hover:bg-white/5 transition-all duration-150"
            >
              <Plus className="w-4 h-4 text-[#E8F0FF]/30" />
              <span>Nuevo Proyecto</span>
            </button>
          </div>
        </nav>

        {/* User bottom */}
        <div className="p-3 border-t border-white/8">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-white/5 transition-colors duration-150">
                <Avatar className="w-6 h-6">
                  <AvatarImage src={session?.user?.image || ""} />
                  <AvatarFallback className="text-[10px] font-medium"
                    style={{ background: "linear-gradient(135deg,#00F5C8,#7B5EF8)", color: "#0A0E1A" }}>
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[13px] font-medium text-[#E8F0FF]/80 truncate">
                    {session?.user?.name || "Usuario"}
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[#E8F0FF]/30" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-[#0D1117] border-white/10">
              <DropdownMenuLabel className="text-[#E8F0FF]/40 text-xs">Mi Cuenta</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/8" />
              <DropdownMenuItem asChild className="text-[#E8F0FF]/70 text-sm focus:bg-white/5 focus:text-[#E8F0FF] cursor-pointer">
                <Link href="/dashboard/settings"><User className="w-4 h-4 mr-2 text-[#E8F0FF]/30" />Perfil</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="text-[#E8F0FF]/70 text-sm focus:bg-white/5 focus:text-[#E8F0FF] cursor-pointer">
                <Link href="/pricing"><CreditCard className="w-4 h-4 mr-2 text-[#E8F0FF]/30" />Facturación</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="text-[#E8F0FF]/70 text-sm focus:bg-white/5 focus:text-[#E8F0FF] cursor-pointer">
                <Link href="/dashboard/settings"><Key className="w-4 h-4 mr-2 text-[#E8F0FF]/30" />API Keys</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/8" />
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
        <header className="sticky top-0 z-30 h-14 bg-[rgba(10,14,26,0.8)] backdrop-blur-xl border-b border-white/8">
          <div className="flex items-center justify-between h-full px-4 lg:px-6">

            {/* Left */}
            <div className="flex items-center gap-3">
              <button className="lg:hidden p-1.5 rounded-lg text-[#E8F0FF]/50 hover:text-[#E8F0FF] hover:bg-white/5 transition-colors"
                onClick={() => setSidebarOpen(true)}>
                <Menu className="w-5 h-5" />
              </button>

              {/* Mobile logo — visible only when sidebar is hidden */}
              <div className="lg:hidden">
                <HealifyLogo size="sm" showText={true} />
              </div>

              {/* Search */}
              <button className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/8 hover:border-[#00F5C8]/20 hover:bg-white/[0.07] transition-all duration-150 group">
                <Search className="w-3.5 h-3.5 text-[#E8F0FF]/30 group-hover:text-[#E8F0FF]/50" />
                <span className="text-[13px] text-[#E8F0FF]/30">Buscar...</span>
                <kbd className="hidden lg:inline-flex items-center gap-0.5 ml-4 text-[10px] text-[#E8F0FF]/20 bg-white/5 px-1.5 py-0.5 rounded font-mono">
                  ⌘K
                </kbd>
              </button>
            </div>

            {/* Right */}
            <div className="flex items-center gap-1">
              {/* Notifications */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="relative p-2 rounded-lg text-[#E8F0FF]/50 hover:text-[#E8F0FF] hover:bg-white/5 transition-colors">
                    <Bell className="w-4 h-4" />
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#00F5C8] rounded-full ring-2 ring-[#0A0E1A]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 bg-[#0D1117] border-white/10">
                  <DropdownMenuLabel className="text-[#E8F0FF]/40 text-xs uppercase tracking-wider">
                    Notificaciones
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-white/8" />
                  <div className="max-h-64 overflow-y-auto">
                    {[
                      { dot: "#00F5C8", title: "Test autocurado", detail: "login.spec.ts → Selector actualizado", time: "hace 5 minutos" },
                      { dot: "#7B5EF8", title: "Nuevo proyecto", detail: "frontend-app conectado", time: "hace 1 hora" },
                    ].map((n, i) => (
                      <DropdownMenuItem key={i} className="flex flex-col items-start gap-1 p-3 focus:bg-white/5 cursor-pointer">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: n.dot }} />
                          <p className="text-sm text-[#E8F0FF]/80">{n.title}</p>
                        </div>
                        <p className="text-xs text-[#E8F0FF]/40 pl-3.5">{n.detail}</p>
                        <p className="text-[10px] text-[#E8F0FF]/20 pl-3.5 font-mono">{n.time}</p>
                      </DropdownMenuItem>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="w-px h-5 bg-white/10 mx-1" />

              {/* User avatar */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 p-1 rounded-lg hover:bg-white/5 transition-colors">
                    <Avatar className="w-7 h-7">
                      <AvatarImage src={session?.user?.image || ""} />
                      <AvatarFallback className="text-[10px] font-medium"
                        style={{ background: "linear-gradient(135deg,#00F5C8,#7B5EF8)", color: "#0A0E1A" }}>
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-[#0D1117] border-white/10">
                  <DropdownMenuItem asChild className="text-[#E8F0FF]/70 text-sm focus:bg-white/5 focus:text-[#E8F0FF] cursor-pointer">
                    <Link href="/dashboard/settings"><User className="w-4 h-4 mr-2 text-[#E8F0FF]/30" />Perfil</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/8" />
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
        <main className="p-4 lg:p-6 min-h-[calc(100vh-3.5rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}
