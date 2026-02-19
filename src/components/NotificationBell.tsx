'use client'

import { useState, useEffect } from 'react'
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Bell, BellOff, Check, Dot } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'

interface Notification {
    id: string
    type: 'info' | 'success' | 'warning' | 'error'
    title: string
    message: string
    read: boolean
    createdAt: string
    link?: string
}

export function NotificationBell() {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const unreadCount = Array.isArray(notifications) ? notifications.filter(n => !n.read).length : 0
 
     const fetchNotifications = async () => {
         try {
             const res = await fetch('/api/notifications')
             const data = await res.json()
             if (Array.isArray(data)) {
                 setNotifications(data)
             }
         } catch (error) {
            console.error('Error fetching notifications:', error)
        }
    }

    useEffect(() => {
        fetchNotifications()
        // Poll every 30 seconds
        const interval = setInterval(fetchNotifications, 30000)
        return () => clearInterval(interval)
    }, [])

    const markAsRead = async (id: string) => {
        try {
            await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, read: true }),
            })
            setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n))
        } catch (error) {
            console.error('Error marking as read:', error)
        }
    }

    const markAllAsRead = async () => {
        // In prod, call a batch API
        for (const n of notifications.filter(n => !n.read)) {
            await markAsRead(n.id)
        }
    }

    return (
        <div className="relative">
            <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 rounded-full"
                onClick={() => setIsOpen(!isOpen)}
            >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                        {unreadCount}
                    </span>
                )}
            </Button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 z-50 rounded-lg border bg-popover text-popover-foreground shadow-lg animate-in fade-in zoom-in duration-200">
                    <div className="flex items-center justify-between border-b p-4">
                        <h3 className="font-semibold">Notifications</h3>
                        {unreadCount > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-primary"
                                onClick={markAllAsRead}
                            >
                                Mark all as read
                            </Button>
                        )}
                    </div>
                    <ScrollArea className="h-80">
                        {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <BellOff className="h-8 w-8 mb-2 opacity-20" />
                                <p className="text-sm">No notifications yet</p>
                            </div>
                        ) : (
                            <div className="divide-y">
                                {notifications.map((n) => (
                                    <div
                                        key={n.id}
                                        className={cn(
                                            "group relative items-start gap-4 p-4 text-sm transition-colors hover:bg-muted/50",
                                            !n.read && "bg-muted/30"
                                        )}
                                    >
                                        {!n.read && (
                                            <Dot className="absolute -left-1 top-4 h-8 w-8 text-blue-500" />
                                        )}
                                        <div className="space-y-1">
                                            <p className="font-medium leading-none">{n.title}</p>
                                            <p className="text-xs text-muted-foreground line-clamp-2">
                                                {n.message}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground">
                                                {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                                            </p>
                                        </div>
                                        {!n.read && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="absolute right-2 top-4 h-6 w-6 opacity-0 group-hover:opacity-100"
                                                onClick={() => markAsRead(n.id)}
                                            >
                                                <Check className="h-3 w-3" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                    <div className="border-t p-2 text-center">
                        <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground">
                            View all notifications
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
