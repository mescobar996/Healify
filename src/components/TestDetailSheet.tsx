'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { CheckCircle2, XCircle, Clock, Code2, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HealingStatus } from '@/types'

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
    curado: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Curado' },
    fallido: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Fallido' },
    pendiente: { icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Pendiente' },
  }

  const { icon: StatusIcon, color, bg, label } = statusConfig[data.status]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="w-full sm:max-w-lg bg-[#0D1117] border-white/10 text-[#E8F0FF] overflow-y-auto"
        aria-describedby="sheet-description"
      >
        <SheetHeader className="pb-4 border-b border-white/5">
          <SheetTitle className="text-white text-left font-mono text-sm leading-relaxed">
            {data.testName}
          </SheetTitle>
          <p id="sheet-description" className="text-xs text-gray-500 text-left">
            {data.testFile}
          </p>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {/* Status + Confidence Row */}
          <div className="flex items-center justify-between">
            <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', bg, color)}>
              <StatusIcon className="w-3.5 h-3.5" />
              {label}
            </span>
            <div className="text-right">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-0.5">Confianza IA</p>
              <p className={cn('text-xl font-bold font-mono', confidenceColor)}>
                {data.confidence}%
              </p>
            </div>
          </div>

          {/* Selector Diff */}
          <div className="space-y-3">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <Code2 className="w-3.5 h-3.5" />
              Selector Changes
            </p>
            <div className="rounded-lg bg-[#111113] border border-white/5 overflow-hidden">
              {/* Old */}
              <div className="px-4 py-3 border-b border-white/5">
                <p className="text-[10px] text-red-400 mb-1.5 font-medium">ANTES</p>
                <code className="text-xs text-red-300 font-mono break-all bg-red-500/5 px-2 py-1 rounded block">
                  {data.oldSelector}
                </code>
              </div>
              {/* Arrow */}
              {data.newSelector && (
                <div className="flex items-center justify-center py-2 bg-white/[0.01]">
                  <ArrowRight className="w-4 h-4 text-gray-600" />
                </div>
              )}
              {/* New */}
              {data.newSelector ? (
                <div className="px-4 py-3">
                  <p className="text-[10px] text-emerald-400 mb-1.5 font-medium">DESPUÉS</p>
                  <code className="text-xs text-emerald-300 font-mono break-all bg-emerald-500/5 px-2 py-1 rounded block">
                    {data.newSelector}
                  </code>
                </div>
              ) : (
                <div className="px-4 py-3">
                  <p className="text-xs text-gray-500 italic">Selector no encontrado — requiere revisión manual</p>
                </div>
              )}
            </div>
          </div>

          {/* AI Reasoning */}
          {data.reasoning && (
            <div className="space-y-2">
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">Razonamiento IA</p>
              <div className="rounded-lg bg-[#111113] border border-white/5 p-4">
                <p className="text-xs text-gray-300 leading-relaxed">{data.reasoning}</p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {data.errorMessage && (
            <div className="space-y-2">
              <p className="text-[11px] text-gray-500 uppercase tracking-wider">Error Original</p>
              <div className="rounded-lg bg-red-500/5 border border-red-500/10 p-4">
                <code className="text-xs text-red-300 font-mono">{data.errorMessage}</code>
              </div>
            </div>
          )}

          {/* Timestamp */}
          <p className="text-xs text-gray-500">{data.timestamp}</p>
        </div>

        {/* Actions — only shown for pending */}
        {data.status === 'pendiente' && data.newSelector && (
          <div className="pt-4 border-t border-white/5 flex gap-3">
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => onApprove(data.id)}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Aprobar curación
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
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
