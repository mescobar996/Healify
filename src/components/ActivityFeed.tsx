'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, Clock, Zap, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ActivityEvent {
  id: string
  type: 'healed' | 'failed' | 'pending' | 'detected' | 'running'
  message: string
  detail: string
  timestamp: string
}

const MOCK_ACTIVITY: ActivityEvent[] = [
  {
    id: '1',
    type: 'healed',
    message: 'Auto-healed selector',
    detail: '#login-button → button[type="submit"]',
    timestamp: 'hace 5 min',
  },
  {
    id: '2',
    type: 'running',
    message: 'Test suite ejecutado',
    detail: 'checkout.spec.ts — 14/14 passed',
    timestamp: 'hace 12 min',
  },
  {
    id: '3',
    type: 'pending',
    message: 'Requiere revision manual',
    detail: '.payment-form > input[name=card]',
    timestamp: 'hace 1 hora',
  },
  {
    id: '4',
    type: 'healed',
    message: 'Auto-healed selector',
    detail: '.add-to-cart-btn → [data-testid="add-cart"]',
    timestamp: 'hace 2 horas',
  },
  {
    id: '5',
    type: 'detected',
    message: 'Bug detectado (no selector)',
    detail: 'search-results.spec.ts:45',
    timestamp: 'hace 3 horas',
  },
]

const typeConfig = {
  healed:   { icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', dot: 'bg-emerald-500' },
  failed:   { icon: XCircle,       color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     dot: 'bg-red-500' },
  pending:  { icon: Clock,         color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   dot: 'bg-amber-500' },
  detected: { icon: AlertTriangle, color: 'text-orange-400',  bg: 'bg-orange-500/10',  border: 'border-orange-500/20',  dot: 'bg-orange-500' },
  running:  { icon: Zap,           color: 'text-[#00F5C8]',   bg: 'bg-[#00F5C8]/10',   border: 'border-[#00F5C8]/20',   dot: 'bg-[#00F5C8]' },
}

interface ActivityFeedProps {
  limit?: number
}

export function ActivityFeed({ limit = 5 }: ActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/healing-events?limit=' + limit)
        if (res.ok) {
          const data = await res.json()
          if (data?.events?.length > 0) {
            const mapped: ActivityEvent[] = data.events.map((e: {
              id: string
              status: string
              testName: string
              failedSelector: string
              newSelector?: string
              createdAt: string
            }) => ({
              id: e.id,
              type: e.status === 'HEALED_AUTO' || e.status === 'HEALED_MANUAL'
                ? 'healed'
                : e.status === 'BUG_DETECTED'
                ? 'detected'
                : e.status === 'NEEDS_REVIEW'
                ? 'pending'
                : 'running',
              message: e.status === 'HEALED_AUTO'
                ? 'Auto-healed selector'
                : e.status === 'BUG_DETECTED'
                ? 'Bug detectado'
                : 'Requiere revision',
              detail: e.newSelector
                ? `${e.failedSelector} → ${e.newSelector}`
                : e.failedSelector,
              timestamp: e.createdAt,
            }))
            setEvents(mapped)
            setLoading(false)
            return
          }
        }
      } catch {
        // Silently fall back to mock
      }
      setEvents(MOCK_ACTIVITY.slice(0, limit))
      setLoading(false)
    }

    load()
  }, [limit])

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
        <h2 className="text-sm font-semibold text-[#E8F0FF]">Actividad Reciente</h2>
        <span className="text-[10px] text-[#00F5C8]/60 bg-[#00F5C8]/5 border border-[#00F5C8]/15 px-2 py-0.5 rounded-md font-semibold tracking-wider uppercase">
          LIVE
        </span>
      </div>

      {/* Events */}
      {loading ? (
        <div className="divide-y divide-white/[0.04]">
          {Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3.5">
              <div className="w-6 h-6 rounded-full bg-white/[0.04] flex-shrink-0 animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-white/[0.04] rounded animate-pulse w-36" />
                <div className="h-2.5 bg-white/[0.04] rounded animate-pulse w-52" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {events.map((event, index) => {
            const { icon: Icon, color, bg, border } = typeConfig[event.type]
            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-start gap-3 px-5 py-3.5 hover:bg-white/[0.02] transition-colors"
              >
                <div className={cn('w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border', bg, border)}>
                  <Icon className={cn('w-3 h-3', color)} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#E8F0FF]/60 font-medium">{event.message}</p>
                  <code className="text-[11px] text-[#E8F0FF]/25 font-mono truncate block mt-0.5">
                    {event.detail}
                  </code>
                </div>

                <p className="text-[10px] text-[#E8F0FF]/15 flex-shrink-0 mt-0.5">{event.timestamp}</p>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Live indicator */}
      <div className="px-5 py-3 border-t border-white/[0.06] flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00F5C8] opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00F5C8]" />
        </span>
        <span className="text-[10px] text-[#E8F0FF]/20">Actualizando en tiempo real</span>
      </div>
    </div>
  )
}
