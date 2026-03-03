'use client'

/**
 * SelectorDiff — visual character-level diff between two CSS/XPath selectors.
 *
 * Highlights:
 *   - Removed segments in red
 *   - Added segments in violet/green
 *   - Unchanged segments in dim white
 *
 * Algorithm: simple token-level LCS diff (split by space | > | . | # | [ | ])
 */

import { ArrowRight, Code2 } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Token diff helpers ──────────────────────────────────────────────────────

type DiffToken = { text: string; kind: 'same' | 'removed' | 'added' }

function tokenize(selector: string): string[] {
  // Split on boundaries: space, >, +, ~, ., #, [, ], (, ), "
  return selector.split(/(?=[\s>+~.#\[(\])"@:])/).filter(Boolean)
}

function lcs<T>(a: T[], b: T[]): number[][] {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp
}

function computeDiff(oldSel: string, newSel: string): { old: DiffToken[]; new: DiffToken[] } {
  const aTokens = tokenize(oldSel)
  const bTokens = tokenize(newSel)
  const dp = lcs(aTokens, bTokens)

  const oldResult: DiffToken[] = []
  const newResult: DiffToken[] = []

  let i = aTokens.length
  let j = bTokens.length

  const removedInNew: number[] = []
  const addedInNew: number[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aTokens[i - 1] === bTokens[j - 1]) {
      oldResult.unshift({ text: aTokens[i - 1], kind: 'same' })
      newResult.unshift({ text: bTokens[j - 1], kind: 'same' })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      newResult.unshift({ text: bTokens[j - 1], kind: 'added' })
      addedInNew.push(j - 1)
      j--
    } else {
      oldResult.unshift({ text: aTokens[i - 1], kind: 'removed' })
      removedInNew.push(i - 1)
      i--
    }
  }

  return { old: oldResult, new: newResult }
}

// ── Render helpers ──────────────────────────────────────────────────────────

function TokenSpan({ token }: { token: DiffToken }) {
  if (token.kind === 'removed') {
    return (
      <span className="bg-red-500/20 text-red-300 rounded px-0.5 line-through decoration-red-400/70">
        {token.text}
      </span>
    )
  }
  if (token.kind === 'added') {
    return (
      <span className="bg-violet-500/20 text-violet-300 rounded px-0.5">
        {token.text}
      </span>
    )
  }
  return <span className="text-gray-300">{token.text}</span>
}

// ── Public component ────────────────────────────────────────────────────────

interface SelectorDiffProps {
  /** Original (broken) selector */
  oldSelector: string
  /** New (healed) selector — if null shows "not found" */
  newSelector: string | null
  /** Additional CSS class */
  className?: string
  /** Show label above the diff block */
  showLabel?: boolean
}

export function SelectorDiff({ oldSelector, newSelector, className, showLabel = true }: SelectorDiffProps) {
  const diff = newSelector ? computeDiff(oldSelector, newSelector) : null

  return (
    <div className={cn('space-y-3', className)}>
      {showLabel && (
        <p className="text-[11px] text-gray-500 uppercase tracking-wider flex items-center gap-2">
          <Code2 className="w-3.5 h-3.5" />
          Selector Changes
        </p>
      )}

      <div className="rounded-lg bg-[#111113] border border-white/5 overflow-hidden text-xs font-mono">
        {/* Old selector */}
        <div className="px-4 py-3 border-b border-white/5">
          <p className="text-[10px] text-red-400 mb-2 font-sans font-medium tracking-wider uppercase">Antes</p>
          <code className="break-all leading-relaxed block">
            {diff
              ? diff.old.map((t, i) => <TokenSpan key={i} token={t} />)
              : <span className="text-red-300">{oldSelector}</span>}
          </code>
        </div>

        {/* Arrow separator */}
        {newSelector && (
          <div className="flex items-center justify-center py-2 bg-white/[0.015]">
            <ArrowRight className="w-3.5 h-3.5 text-gray-600" />
          </div>
        )}

        {/* New selector */}
        {newSelector ? (
          <div className="px-4 py-3">
            <p className="text-[10px] text-violet-400 mb-2 font-sans font-medium tracking-wider uppercase">Después</p>
            <code className="break-all leading-relaxed block">
              {diff
                ? diff.new.map((t, i) => <TokenSpan key={i} token={t} />)
                : <span className="text-violet-300">{newSelector}</span>}
            </code>
          </div>
        ) : (
          <div className="px-4 py-3">
            <p className="text-xs text-gray-500 italic font-sans">Selector no encontrado — requiere revisión manual</p>
          </div>
        )}
      </div>

      {/* Summary badge */}
      {diff && (
        <div className="flex gap-2 text-[10px]">
          {diff.old.some(t => t.kind === 'removed') && (
            <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">
              {diff.old.filter(t => t.kind === 'removed').length} eliminado{diff.old.filter(t => t.kind === 'removed').length !== 1 ? 's' : ''}
            </span>
          )}
          {diff.new.some(t => t.kind === 'added') && (
            <span className="px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400">
              {diff.new.filter(t => t.kind === 'added').length} agregado{diff.new.filter(t => t.kind === 'added').length !== 1 ? 's' : ''}
            </span>
          )}
          {!diff.old.some(t => t.kind === 'removed') && !diff.new.some(t => t.kind === 'added') && (
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">Sin cambios</span>
          )}
        </div>
      )}
    </div>
  )
}
