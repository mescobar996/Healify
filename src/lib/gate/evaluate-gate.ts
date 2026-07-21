import type { SelectorType } from '@/lib/enums'
import { selectorAnalyzer } from '@/lib/selector-analyzer'

export interface GateInput {
  confidence: number
  selector: string
  selectorType: SelectorType
  /** project.autoHealThreshold — caller resolves any null/undefined fallback before calling. */
  threshold: number
  /** Truncated DOM snapshot (oldDomSnapshot/newDomSnapshot), if one was captured. */
  domSnapshot?: string
}

export type GateFailureReason =
  | { code: 'low_confidence'; confidence: number; threshold: number }
  | { code: 'fragile_selector'; score: number }
  | { code: 'not_unique'; matches: number }

export interface GateResult {
  pass: boolean
  blockedBy: GateFailureReason[]
}

// Same cutoff selector-analyzer.ts already uses for "Critical risk" in getRecommendation().
const FRAGILE_SCORE_CEILING = 0.40

export function evaluateGate(input: GateInput): GateResult {
  const blockedBy: GateFailureReason[] = []

  if (input.confidence < input.threshold) {
    blockedBy.push({ code: 'low_confidence', confidence: input.confidence, threshold: input.threshold })
  }

  const score = selectorAnalyzer.calculateScore(input.selector, input.selectorType)
  if (score < FRAGILE_SCORE_CEILING) {
    blockedBy.push({ code: 'fragile_selector', score })
  }

  if (input.domSnapshot) {
    const matches = countSimpleSelectorMatches(input.selector, input.domSnapshot)
    if (matches !== null && matches > 1) {
      blockedBy.push({ code: 'not_unique', matches })
    }
  }

  return { pass: blockedBy.length === 0, blockedBy }
}

// ── DOM uniqueness — best-effort regex count, no HTML parser ───────────
//
// Only counts three simple, unambiguous selector shapes (#id, .single-class,
// [data-*="..."]/[aria-*="..."]). Anything else (combinators, pseudo-classes,
// XPath) returns null — "indeterminate" — and is never used to block, because
// a truncated 8000-char snapshot can't be trusted for anything more complex
// than a literal attribute match.

function countSimpleSelectorMatches(selector: string, html: string): number | null {
  const idMatch = selector.match(/^#([A-Za-z0-9_-]+)$/)
  if (idMatch) {
    // (?<![\w-]) instead of \b: \b would also match inside "data-id=" (the
    // hyphen->"i" transition is itself a word boundary), wrongly counting
    // unrelated attributes that merely end in "id". Requires the char right
    // before "id=" to not be a word char or hyphen (or start-of-string).
    const re = new RegExp(`(?<![\\w-])id=["']${escapeRegExp(idMatch[1])}["']`, 'g')
    return (html.match(re) ?? []).length
  }

  const classMatch = selector.match(/^\.([A-Za-z0-9_-]+)$/)
  if (classMatch) {
    const classAttrRe = /\bclass=["']([^"']*)["']/g
    let count = 0
    let m: RegExpExecArray | null
    while ((m = classAttrRe.exec(html)) !== null) {
      if (m[1].split(/\s+/).includes(classMatch[1])) count++
    }
    return count
  }

  const attrMatch = selector.match(/^\[((?:data|aria)-[A-Za-z0-9_-]+)=["']([^"']+)["']\]$/)
  if (attrMatch) {
    const [, attrName, attrValue] = attrMatch
    // Same (?<![\w-]) fix as above: \b would let a shorter attribute name
    // match as a suffix of a longer, unrelated one sharing the same tail
    // (e.g. a hypothetical "data-x-testid" satisfying "data-testid=").
    const re = new RegExp(`(?<![\\w-])${escapeRegExp(attrName)}=["']${escapeRegExp(attrValue)}["']`, 'g')
    return (html.match(re) ?? []).length
  }

  return null
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
