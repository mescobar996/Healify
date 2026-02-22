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
  X,
  Bell,
  Search,
  Zap,
  ChevronDown,
  LogOut,
  User,
  CreditCard,
  Key,
  Plus,
  ExternalLink,
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
import { signOut } from "next-auth/react";
import { toast } from "sonner";

// ============================================
// LINEAR DESIGN SYSTEM - NAVIGATION
// ============================================

const navItems = [
  { 
    name: "Dashboard", 
    href: "/dashboard", 
    icon: LayoutDashboard,
    badge: null 
  },
  { 
    name: "Proyectos", 
    href: "/dashboard/projects", 
    icon: FolderKanban,
    badge: "3" 
  },
  { 
    name: "Tests", 
    href: "/dashboard/tests", 
    icon: TestTube2,
    badge: "12" 
  },
  { 
    name: "Configuración", 
    href: "/dashboard/settings", 
    icon: Settings,
    badge: null 
  },
];

// ============================================
// LINEAR STYLE SIDEBAR
// ============================================

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Handler para cerrar sesión
  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' })
    toast.success('Sesión cerrada correctamente')
  }

  // Handler para nuevo proyecto
  const handleNewProject = () => {
    router.push('/dashboard/projects')
    toast.info('Selecciona un repositorio para conectar')
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-gray-100">
      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar - Linear Style */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-56 transform bg-[#0f0f10] border-r border-white/5 transition-transform duration-200 ease-in-out lg:translate-x-0 flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo Area */}
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-white/5">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/20">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="text-base font-semibold text-white tracking-tight">
            Healify
          </span>
          <span className="ml-auto text-[10px] font-medium text-gray-500 bg-gray-800/50 px-1.5 py-0.5 rounded">
            v0.4
          </span>
        </div>

        {/* Workspace Selector - Linear Style */}
        <div className="px-3 py-3 border-b border-white/5">
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors duration-150">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white">
              P
            </div>
            <span className="text-sm text-gray-300 flex-1 text-left truncate">
              Proyecto Principal
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {/* Section Label */}
          <div className="px-2 py-2">
            <span className="text-[10px] font-medium tracking-widest text-gray-500 uppercase">
              Navegación
            </span>
          </div>

          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-all duration-150 group",
                  isActive
                    ? "bg-white/5 text-white"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                )}
              >
                <item.icon 
                  className={cn(
                    "w-4 h-4 transition-colors duration-150",
                    isActive ? "text-emerald-400" : "text-gray-500 group-hover:text-gray-300"
                  )} 
                />
                <span className="flex-1">{item.name}</span>
                {item.badge && (
                  <span className="text-[10px] font-medium text-gray-500 bg-gray-800/80 px-1.5 py-0.5 rounded">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}

          {/* Quick Actions */}
          <div className="pt-4 mt-4 border-t border-white/5">
            <div className="px-2 py-2">
              <span className="text-[10px] font-medium tracking-widest text-gray-500 uppercase">
                Acciones Rápidas
              </span>
            </div>
            <button 
              onClick={handleNewProject}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-all duration-150"
            >
              <Plus className="w-4 h-4 text-gray-500" />
              <span>Nuevo Proyecto</span>
            </button>
          </div>
        </nav>

        {/* User Section - Bottom */}
        <div className="p-3 border-t border-white/5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-white/5 transition-colors duration-150">
                <Avatar className="w-6 h-6">
                  <AvatarImage src="/avatar.png" />
                  <AvatarFallback className="bg-violet-500/20 text-violet-400 text-[10px] font-medium">
                    JD
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[13px] font-medium text-gray-200 truncate">
                    John Doe
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              className="w-48 bg-[#1a1a1c] border-gray-800"
            >
              <DropdownMenuLabel className="text-gray-400 text-xs">
                Mi Cuenta
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-gray-800" />
              <DropdownMenuItem asChild className="text-gray-300 text-sm focus:bg-white/5 focus:text-white cursor-pointer">
                <Link href="/dashboard/settings">
                  <User className="w-4 h-4 mr-2 text-gray-500" />
                  Perfil
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="text-gray-300 text-sm focus:bg-white/5 focus:text-white cursor-pointer">
                <Link href="/pricing">
                  <CreditCard className="w-4 h-4 mr-2 text-gray-500" />
                  Facturación
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="text-gray-300 text-sm focus:bg-white/5 focus:text-white cursor-pointer">
                <Link href="/dashboard/settings">
                  <Key className="w-4 h-4 mr-2 text-gray-500" />
                  API Keys
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-gray-800" />
              <DropdownMenuItem 
                onClick={handleSignOut}
                className="text-red-400 text-sm focus:bg-white/5 focus:text-red-300 cursor-pointer"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-56">
        {/* Top Header - Linear Style */}
        <header className="sticky top-0 z-30 h-14 bg-[#0a0a0b]/80 backdrop-blur-xl border-b border-white/5">
          <div className="flex items-center justify-between h-full px-4 lg:px-6">
            {/* Left Side */}
            <div className="flex items-center gap-3">
              {/* Mobile Menu Button */}
              <button
                className="lg:hidden p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition-colors duration-150"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Search - Command Palette Style */}
              <button 
                onClick={() => setCommandPaletteOpen(true)}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/[0.07] transition-all duration-150 group"
              >
                <Search className="w-3.5 h-3.5 text-gray-500 group-hover:text-gray-400" />
                <span className="text-[13px] text-gray-400">Buscar...</span>
                <kbd className="hidden lg:inline-flex items-center gap-0.5 ml-4 text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </button>
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-1">
              {/* Notifications */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="relative p-2 rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition-colors duration-150">
                    <Bell className="w-4 h-4" />
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-emerald-500 rounded-full ring-2 ring-[#0a0a0b]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  className="w-72 bg-[#1a1a1c] border-gray-800"
                >
                  <DropdownMenuLabel className="text-gray-400 text-xs uppercase tracking-wider">
                    Notificaciones
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-gray-800" />
                  <div className="max-h-64 overflow-y-auto">
                    <DropdownMenuItem className="flex flex-col items-start gap-1 p-3 focus:bg-white/5">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <p className="text-sm text-gray-200">
                          Test autocurado
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 pl-3.5">
                        login.spec.ts → Selector actualizado
                      </p>
                      <p className="text-[10px] text-gray-600 pl-3.5">
                        hace 5 minutos
                      </p>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="flex flex-col items-start gap-1 p-3 focus:bg-white/5">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        <p className="text-sm text-gray-200">
                          Nuevo proyecto
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 pl-3.5">
                        frontend-app conectado
                      </p>
                      <p className="text-[10px] text-gray-600 pl-3.5">
                        hace 1 hora
                      </p>
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Divider */}
              <div className="w-px h-5 bg-white/10 mx-1" />

              {/* User Avatar */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 p-1 rounded-md hover:bg-white/5 transition-colors duration-150">
                    <Avatar className="w-6 h-6">
                      <AvatarImage src="/avatar.png" />
                      <AvatarFallback className="bg-violet-500/20 text-violet-400 text-[10px] font-medium">
                        JD
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  className="w-48 bg-[#1a1a1c] border-gray-800"
                >
                  <DropdownMenuItem asChild className="text-gray-300 text-sm focus:bg-white/5 focus:text-white cursor-pointer">
                    <Link href="/dashboard/settings">
                      <User className="w-4 h-4 mr-2 text-gray-500" />
                      Perfil
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="text-gray-300 text-sm focus:bg-white/5 focus:text-white cursor-pointer">
                    <Link href="/dashboard/settings">
                      <Settings className="w-4 h-4 mr-2 text-gray-500" />
                      Configuración
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-gray-800" />
                  <DropdownMenuItem 
                    onClick={handleSignOut}
                    className="text-red-400 text-sm focus:bg-white/5 focus:text-red-300 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-6 min-h-[calc(100vh-3.5rem)]">
          {children}
        </main>
      </div>
    </div>
  );
}
