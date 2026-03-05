'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HealingStatus } from '@/types'
import { SelectorDiff } from '@/components/SelectorDiff'
import { ScreenshotComparator } from '@/components/ScreenshotComparator'

interface TestDetailData {
  id: string
  testName: string
  testFile: string
  status: HealingStatus
  confidence: number
  timestamp: string
  errorMessage: string | null
  oldSelector: string
  newSelector: string | null
  reasoning: string | null
  screenshotBefore?: string | null
  screenshotAfter?: string | null
}

interface TestDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: TestDetailData | null
  onApprove: (id: string) => void
  onReject: (id: string) => void
}

export function TestDetailSheet({
  open,
  onOpenChange,
  data,
  onApprove,
  onReject,
}: TestDetailSheetProps) {
  if (!data) return null

  const confidenceColor =
    data.confidence >= 80
      ? 'text-emerald-400'
      : data.confidence >= 50
      ? 'text-amber-400'
      : 'text-red-400'

  const statusConfig = {
    curado: { icon: CheckCircle2, color: 'text-violet-400', bg: 'bg-violet-500/10', label: 'Curado' },
    fallido: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Fallido' },
    pendiente: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Pendiente' },
  }

  const { icon: StatusIcon, color, bg, label } = statusConfig[data.status]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full sm:max-w-xl bg-[#0A0D12] border-l border-white/[0.08] text-[#E8F0FF] overflow-y-auto"
        aria-describedby="sheet-description"
      >
        <div className="px-6 pt-6 pb-5 border-b border-white/[0.06]">
          <SheetHeader className="p-0">
            <SheetTitle className="text-white text-left font-mono text-base leading-relaxed tracking-tight">
              {data.testName}
            </SheetTitle>
            <p id="sheet-description" className="text-[13px] text-gray-500 text-left mt-1">
              {data.testFile}
            </p>
          </SheetHeader>
        </div>

        <div className="px-6 py-6 space-y-7">
          {/* Status + Confidence Row */}
          <div className="flex items-center justify-between">
            <span className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-medium', bg, color)}>
              <StatusIcon className="w-4 h-4" />
              {label}
            </span>
            <div className="text-right">
              <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">Confianza IA</p>
              <p className={cn('text-2xl font-bold font-mono', confidenceColor)}>
                {data.confidence}%
              </p>
            </div>
          </div>

          {/* Selector Diff */}
          <div className="space-y-2.5">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Selector Changes</p>
            <SelectorDiff oldSelector={data.oldSelector} newSelector={data.newSelector} />
          </div>

          {/* Screenshot Comparator */}
          {data.screenshotBefore && data.screenshotAfter && (
            <div className="space-y-2.5">
              <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Capturas</p>
              <ScreenshotComparator
                beforeUrl={data.screenshotBefore}
                afterUrl={data.screenshotAfter}
                testName={data.testName}
              />
            </div>
          )}

          {/* AI Reasoning */}
          {data.reasoning && (
            <div className="space-y-2.5">
              <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Razonamiento IA</p>
              <div className="rounded-xl bg-[#111316] border border-white/[0.06] p-5">
                <p className="text-[13px] text-gray-300 leading-relaxed">{data.reasoning}</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {data.errorMessage && (
            <div className="space-y-2.5">
              <p className="text-[11px] text-gray-500 uppercase tracking-wider font-medium">Error Original</p>
              <div className="rounded-xl bg-red-500/5 border border-red-500/10 p-5">
                <code className="text-[13px] text-red-300 font-mono leading-relaxed">{data.errorMessage}</code>
              </div>
            </div>
          )}

          {/* Timestamp */}
          <p className="text-[13px] text-gray-500 pt-1">
            {new Date(data.timestamp).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>

        {/* Actions — only shown for pending */}
        {data.status === 'pendiente' && data.newSelector && (
          <div className="px-6 py-5 border-t border-white/[0.06] flex gap-3">
            <Button
              size="lg"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white h-11"
              onClick={() => onApprove(data.id)}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Aprobar curación
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 h-11"
              onClick={() => onReject(data.id)}
            >
              <XCircle className="w-4 h-4 mr-2" />
              Rechazar
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
