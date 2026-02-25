"use client";

import React, { useState, useEffect, useCallback } from "react";
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

  // ── Notifications real state ──
  interface Notif { id: string; type: string; title: string; message: string; read: boolean; link?: string; createdAt: string }
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [notifsOpen, setNotifsOpen] = useState(false);

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { credentials: "include" });
      if (res.ok) setNotifs(await res.json());
    } catch {}
  }, []);

  useEffect(() => { fetchNotifs(); }, [fetchNotifs]);

  const markRead = async (id: string) => {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await fetch("/api/notifications", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, read: true }),
    });
  };

  const markAllRead = async () => {
    const unread = notifs.filter(n => !n.read);
    setNotifs(prev => prev.map(n => ({ ...n, read: true })));
    await Promise.all(unread.map(n =>
      fetch("/api/notifications", {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id, read: true }),
      })
    ));
  };

  const unreadCount = notifs.filter(n => !n.read).length;

  const notifDotColor: Record<string, string> = {
    success: "#10B981", info: "#6366F1", warning: "#EAB308", error: "#EF4444",
  };

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" });
    toast.success("Sesión cerrada correctamente");
  };

  const userInitials = session?.user?.name
    ? session.user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "HF";

  return (
    <div className="min-h-screen bg-[#000000] text-[#E6E6E6]">

      {/* ── Mobile overlay ─────────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/80  lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-56 flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0",
        "bg-[#0A0A0A] border-r border-[#111111]",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 h-14 border-b border-[#1C1C1C]">
          <HealifyLogo size="sm" showText={true} />
          <span className="ml-auto text-[10px] font-medium text-[#E6E6E6]/30 bg-[#111111] px-1.5 py-0.5 rounded font-mono">
            v0.4
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <div className="px-2 py-2">
            <span className="text-[10px] font-medium tracking-widest text-[#E6E6E6]/30 uppercase">
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
                    ? "bg-[#111111] text-[#E6E6E6] border-l-[3px] border-l-[#6366F1] border-y-0 border-r-0"
                    : "text-[#E6E6E6]/50 hover:text-[#E6E6E6] hover:bg-[#111111]"
                )}
              >
                <item.icon className={cn(
                  "w-4 h-4 transition-colors duration-150",
                  isActive ? "text-[#6366F1]" : "text-[#5C5C5C] group-hover:text-[#9CA3AF]"
                )} />
                <span className="flex-1">{item.name}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1]" />
                )}
              </Link>
            );
          })}

          {/* Quick actions */}
          <div className="pt-4 mt-4 border-t border-[#1C1C1C]">
            <div className="px-2 py-2">
              <span className="text-[10px] font-medium tracking-widest text-[#E6E6E6]/30 uppercase">
                Acciones rápidas
              </span>
            </div>
            <button
              onClick={() => { router.push("/dashboard/projects"); setSidebarOpen(false); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] font-medium text-[#E6E6E6]/50 hover:text-[#E6E6E6] hover:bg-[#111111] transition-all duration-150"
            >
              <Plus className="w-4 h-4 text-[#E6E6E6]/30" />
              <span>Nuevo Proyecto</span>
            </button>
          </div>
        </nav>

        {/* User bottom */}
        <div className="p-3 border-t border-[#1C1C1C]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-[#111111] transition-colors duration-150">
                <Avatar className="w-6 h-6">
                  <AvatarImage src={session?.user?.image || ""} />
                  <AvatarFallback className="text-[10px] font-medium"
                    style={{ background: "#6366F1", color: "#000000" }}>
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[13px] font-medium text-[#E6E6E6]/80 truncate">
                    {session?.user?.name || "Usuario"}
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[#E6E6E6]/30" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-[#0F0F0F] border-[#1C1C1C]">
              <DropdownMenuLabel className="text-[#E6E6E6]/40 text-xs">Mi Cuenta</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/8" />
              <DropdownMenuItem asChild className="text-[#E6E6E6]/70 text-sm focus:bg-[#111111] focus:text-[#E6E6E6] cursor-pointer">
                <Link href="/dashboard/settings"><User className="w-4 h-4 mr-2 text-[#E6E6E6]/30" />Perfil</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="text-[#E6E6E6]/70 text-sm focus:bg-[#111111] focus:text-[#E6E6E6] cursor-pointer">
                <Link href="/pricing"><CreditCard className="w-4 h-4 mr-2 text-[#E6E6E6]/30" />Facturación</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="text-[#E6E6E6]/70 text-sm focus:bg-[#111111] focus:text-[#E6E6E6] cursor-pointer">
                <Link href="/dashboard/settings"><Key className="w-4 h-4 mr-2 text-[#E6E6E6]/30" />API Keys</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/8" />
              <DropdownMenuItem onClick={handleSignOut}
                className="text-red-400 text-sm focus:bg-[#111111] focus:text-red-300 cursor-pointer">
                <LogOut className="w-4 h-4 mr-2" />Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────── */}
      <div className="lg:pl-56">

        {/* Top header */}
        <header className="sticky top-0 z-30 h-14 bg-[#0A0A0A] border-b border-[#111111]">
          <div className="flex items-center justify-between h-full px-4 lg:px-6">

            {/* Left */}
            <div className="flex items-center gap-3">
              <button className="lg:hidden p-1.5 rounded-lg text-[#E6E6E6]/50 hover:text-[#E6E6E6] hover:bg-[#111111] transition-colors"
                onClick={() => setSidebarOpen(true)}>
                <Menu className="w-5 h-5" />
              </button>

              {/* Mobile logo — visible only when sidebar is hidden */}
              <div className="lg:hidden">
                <HealifyLogo size="sm" showText={true} />
              </div>

              {/* Search */}
              <button className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#111111] border border-[#1C1C1C] hover:border-[#6366F1]/30 hover:bg-[#121212] transition-all duration-150 group">
                <Search className="w-3.5 h-3.5 text-[#E6E6E6]/30 group-hover:text-[#E6E6E6]/50" />
                <span className="text-[13px] text-[#E6E6E6]/30">Buscar...</span>
                <kbd className="hidden lg:inline-flex items-center gap-0.5 ml-4 text-[10px] text-[#E6E6E6]/20 bg-[#111111] px-1.5 py-0.5 rounded font-mono">
                  ⌘K
                </kbd>
              </button>
            </div>

            {/* Right */}
            <div className="flex items-center gap-1">
              {/* Notifications — real data from /api/notifications */}
              <DropdownMenu open={notifsOpen} onOpenChange={(o) => { setNotifsOpen(o); if (o) fetchNotifs(); }}>
                <DropdownMenuTrigger asChild>
                  <button className="relative p-2 rounded-lg text-[#E6E6E6]/50 hover:text-[#E6E6E6] hover:bg-[#111111] transition-colors">
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 min-w-[14px] h-[14px] px-[3px] bg-[#6366F1] rounded-full ring-2 ring-[#000000] flex items-center justify-center">
                        <span className="text-[#000000] text-[9px] font-bold leading-none">{unreadCount > 9 ? "9+" : unreadCount}</span>
                      </span>
                    )}
                    {unreadCount === 0 && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#E6E6E6]/20 rounded-full ring-2 ring-[#000000]" />}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[calc(100vw-1rem)] sm:w-80 bg-[#0F0F0F] border-[#1C1C1C] p-0">
                  <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#1C1C1C]">
                    <span className="text-[#E6E6E6]/40 text-xs uppercase tracking-wider font-medium">Notificaciones</span>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-[10px] text-[#6366F1]/70 hover:text-[#6366F1] transition-colors">
                        Marcar todas como leídas
                      </button>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Bell className="w-6 h-6 text-[#E6E6E6]/20 mb-2" />
                        <p className="text-xs text-[#E6E6E6]/30">Sin notificaciones</p>
                        <p className="text-[10px] text-[#E6E6E6]/20 mt-1">Te avisaremos cuando haya actividad</p>
                      </div>
                    ) : (
                      notifs.map((n) => (
                        <DropdownMenuItem
                          key={n.id}
                          className={cn("flex flex-col items-start gap-1 p-3 focus:bg-[#111111] cursor-pointer border-b border-[#1C1C1C] last:border-0", !n.read && "bg-[#0D0D0D]")}
                          onClick={() => markRead(n.id)}
                        >
                          <div className="flex items-center gap-2 w-full">
                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: notifDotColor[n.type] || "#6366F1" }} />
                            <p className={cn("text-sm flex-1", n.read ? "text-[#E6E6E6]/60" : "text-[#E6E6E6]/90 font-medium")}>{n.title}</p>
                            {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-[#6366F1] flex-shrink-0" />}
                          </div>
                          <p className="text-xs text-[#E6E6E6]/40 pl-3.5 line-clamp-2">{n.message}</p>
                          <p className="text-[10px] text-[#E6E6E6]/20 pl-3.5 font-mono">
                            {new Date(n.createdAt).toLocaleDateString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </DropdownMenuItem>
                      ))
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="w-px h-5 bg-white/10 mx-1" />

              {/* User avatar */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 p-1 rounded-lg hover:bg-[#111111] transition-colors">
                    <Avatar className="w-7 h-7">
                      <AvatarImage src={session?.user?.image || ""} />
                      <AvatarFallback className="text-[10px] font-medium"
                        style={{ background: "#6366F1", color: "#000000" }}>
                        {userInitials}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 bg-[#0F0F0F] border-[#1C1C1C]">
                  <DropdownMenuItem asChild className="text-[#E6E6E6]/70 text-sm focus:bg-[#111111] focus:text-[#E6E6E6] cursor-pointer">
                    <Link href="/dashboard/settings"><User className="w-4 h-4 mr-2 text-[#E6E6E6]/30" />Perfil</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/8" />
                  <DropdownMenuItem onClick={handleSignOut}
                    className="text-red-400 text-sm focus:bg-[#111111] focus:text-red-300 cursor-pointer">
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
