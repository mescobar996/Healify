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

// Mock activity — replaced by real API when DB is connected
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
    message: 'Requiere revisión manual',
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
  healed: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', dot: 'bg-emerald-500' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', dot: 'bg-red-500' },
  pending: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', dot: 'bg-amber-500' },
  detected: { icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/10', dot: 'bg-orange-500' },
  running: { icon: Zap, color: 'text-cyan-400', bg: 'bg-cyan-500/10', dot: 'bg-cyan-500' },
}

interface ActivityFeedProps {
  limit?: number
}

export function ActivityFeed({ limit = 5 }: ActivityFeedProps) {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Try to fetch real data; fall back to mock
    const load = async () => {
      try {
        const res = await fetch('/api/healing-events?limit=' + limit)
        if (res.ok) {
          const data = await res.json()
          if (data?.events?.length > 0) {
            // Transform API response to ActivityEvent shape
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
                : 'Requiere revisión',
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
    <div className="rounded-lg bg-[#111113] border border-white/5">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <h2 className="text-sm font-medium text-white">Actividad Reciente</h2>
        <span className="text-[10px] text-gray-500 bg-gray-800/50 px-1.5 py-0.5 rounded">
          LIVE
        </span>
      </div>

      {/* Events */}
      {loading ? (
        <div className="divide-y divide-white/5">
          {Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="w-5 h-5 rounded-full bg-white/5 flex-shrink-0 animate-pulse" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-white/5 rounded animate-pulse w-36" />
                <div className="h-2 bg-white/5 rounded animate-pulse w-52" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {events.map((event, index) => {
            const { icon: Icon, color, bg, dot } = typeConfig[event.type]
            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
              >
                {/* Icon */}
                <div className={cn('w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', bg)}>
                  <Icon className={cn('w-3 h-3', color)} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-300 font-medium">{event.message}</p>
                  <code className="text-[11px] text-gray-500 font-mono truncate block mt-0.5">
                    {event.detail}
                  </code>
                </div>

                {/* Time */}
                <p className="text-[10px] text-gray-600 flex-shrink-0 mt-0.5">{event.timestamp}</p>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Live indicator */}
      <div className="px-4 py-2.5 border-t border-white/5 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-[10px] text-gray-500">Actualizando en tiempo real</span>
      </div>
    </div>
  )
}
