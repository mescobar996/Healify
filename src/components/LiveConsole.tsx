'use client'

import { useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useTestRunStream } from '@/hooks/use-test-run-stream'
import { CheckCircle2, XCircle, Zap, Loader2, Wifi, WifiOff, GitPullRequest } from 'lucide-react'
import type { TestRunEvent, TestRunEventType } from '@/lib/event-bus'

// ── Icon per event type ────────────────────────────────────────────────────
const EVENT_ICONS: Partial<Record<TestRunEventType, React.ElementType>> = {
  test_passed:  CheckCircle2,
  test_failed:  XCircle,
  test_healed:  Zap,
  pr_created:   GitPullRequest,
  completed:    CheckCircle2,
  failed:       XCircle,
}

const EVENT_COLORS: Partial<Record<TestRunEventType, string>> = {
  started:      'text-[#EDEDED]/60',
  progress:     'text-[#EDEDED]/50',
  log:          'text-[#EDEDED]/40',
  test_passed:  'text-green-400',
  test_failed:  'text-red-400',
  test_healed:  'text-violet-400',
  pr_created:   'text-sky-400',
  completed:    'text-green-400',
  failed:       'text-red-400',
}

function EventRow({ event }: { event: TestRunEvent }) {
  const Icon = EVENT_ICONS[event.type] ?? Loader2
  const color = EVENT_COLORS[event.type] ?? 'text-[#EDEDED]/50'
  const time = new Date(event.timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <div className="flex items-start gap-2 py-0.5 font-mono text-xs">
      <span className="shrink-0 text-[#EDEDED]/25 tabular-nums">{time}</span>
      <Icon className={cn('mt-0.5 h-3 w-3 shrink-0', color)} />
      <span className={cn('leading-relaxed', color)}>{event.message ?? event.type}</span>
    </div>
  )
}

// ── Progress bar ───────────────────────────────────────────────────────────
function ProgressBar({ progress }: { progress: number }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#00F5C8] to-[#7B5EF8] transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
      />
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
interface LiveConsoleProps {
  testRunId: string | null
  className?: string
  maxHeight?: string
}

export function LiveConsole({ testRunId, className, maxHeight = '320px' }: LiveConsoleProps) {
  const { events, progress, isConnected, isDone, error } = useTestRunStream(testRunId)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom as events arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [events.length])

  const isEmpty = events.length === 0

  return (
    <div
      className={cn(
        'relative flex flex-col gap-2 rounded-xl border border-white/[0.06] bg-[#0D1117] p-4',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-[#EDEDED]/40">
          Live Console
        </span>
        <div className="flex items-center gap-1.5">
          {error ? (
            <span className="flex items-center gap-1 text-xs text-red-400">
              <WifiOff className="h-3 w-3" />
              Disconnected
            </span>
          ) : isDone ? (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircle2 className="h-3 w-3" />
              Done
            </span>
          ) : isConnected ? (
            <span className="flex items-center gap-1 text-xs text-[#00F5C8]">
              <Wifi className="h-3 w-3" />
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00F5C8] opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#00F5C8]" />
              </span>
              Live
            </span>
          ) : testRunId ? (
            <span className="flex items-center gap-1 text-xs text-[#EDEDED]/40">
              <Loader2 className="h-3 w-3 animate-spin" />
              Connecting...
            </span>
          ) : null}
        </div>
      </div>

      {/* Progress bar */}
      {testRunId && !isDone && <ProgressBar progress={progress} />}

      {/* Log area */}
      <div
        className="overflow-y-auto scrollbar-thin scrollbar-thumb-white/10"
        style={{ maxHeight }}
      >
        {isEmpty && testRunId && (
          <p className="py-8 text-center text-xs text-[#EDEDED]/25">
            Waiting for events…
          </p>
        )}
        {isEmpty && !testRunId && (
          <p className="py-8 text-center text-xs text-[#EDEDED]/25">
            Select a test run to watch live output
          </p>
        )}
        {events
          .filter((e) => e.type !== 'close')
          .map((event, i) => (
            <EventRow key={`${event.timestamp}-${i}`} event={event} />
          ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
