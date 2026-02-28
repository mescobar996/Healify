"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Bell, ExternalLink, CheckCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

interface Notif {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  link?: string
  createdAt: string
}

export function NotificationCenter() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<Notif[]>([])

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { credentials: "include" })
      if (!res.ok) return
      setNotifs(await res.json())
    } catch {}
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      void fetchNotifs()
    })
  }, [fetchNotifs])

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        void fetchNotifs()
      })
    }
  }, [open, fetchNotifs])

  const unreadCount = useMemo(() => notifs.filter((n) => !n.read).length, [notifs])

  const markRead = async (id: string) => {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    await fetch("/api/notifications", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, read: true }),
    }).catch(() => {})
  }

  const markAllRead = async () => {
    const unread = notifs.filter((n) => !n.read)
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })))
    await Promise.all(
      unread.map((n) =>
        fetch("/api/notifications", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: n.id, read: true }),
        }).catch(() => {})
      )
    )
  }

  const openTarget = async (notif: Notif) => {
    await markRead(notif.id)
    if (!notif.link) return
    if (notif.link.startsWith("http")) {
      window.open(notif.link, "_blank", "noopener,noreferrer")
      return
    }
    router.push(notif.link)
    setOpen(false)
  }

  const dotByType: Record<string, string> = {
    success: "bg-emerald-400",
    info: "bg-[#5E6AD2]",
    warning: "bg-amber-400",
    error: "bg-red-400",
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative p-2 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[14px] h-[14px] px-[3px] bg-[var(--accent-primary)] rounded-full ring-2 ring-[var(--bg-sidebar)] flex items-center justify-center">
            <span className="text-white text-[9px] font-bold leading-none">{unreadCount > 9 ? "9+" : unreadCount}</span>
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md bg-[#0D0D0D] border-white/[0.08] p-0">
          <SheetHeader className="border-b border-white/[0.08] px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-sm text-[#EDEDED]">Centro de notificaciones</SheetTitle>
                <SheetDescription className="text-xs text-[#9B9B9B]">Alertas accionables y contexto de PRs/tests</SheetDescription>
              </div>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="inline-flex items-center gap-1 text-xs text-[#5E6AD2] hover:text-[#6B79E0]">
                  <CheckCheck className="w-3.5 h-3.5" />
                  Marcar todo
                </button>
              )}
            </div>
          </SheetHeader>

          <div className="h-[calc(100%-76px)] overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-[#6B6B6B]">Sin notificaciones</div>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {notifs.map((n) => (
                  <div key={n.id} className={cn("px-4 py-3 space-y-2", !n.read && "bg-white/[0.02]") }>
                    <div className="flex items-center gap-2">
                      <span className={cn("w-2 h-2 rounded-full", dotByType[n.type] || "bg-[#5E6AD2]")} />
                      <p className={cn("text-sm", n.read ? "text-[#B3B3B3]" : "text-[#EDEDED] font-medium")}>{n.title}</p>
                    </div>
                    <p className="text-xs text-[#9B9B9B] leading-relaxed">{n.message}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-[#6B6B6B]">
                        {new Date(n.createdAt).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {n.link && (
                        <button
                          onClick={() => openTarget(n)}
                          className="inline-flex items-center gap-1 text-xs text-[#5E6AD2] hover:text-[#6B79E0]"
                        >
                          Abrir
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
