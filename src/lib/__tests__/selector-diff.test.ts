/**
 * Tests for SelectorDiff internals — tokenizer + LCS-based diff computation.
 *
 * We re-implement the pure functions here (not the React component) to keep
 * tests fast and dependency-free.
 */
import { describe, it, expect } from 'vitest'

// ── Pure helpers duplicated from SelectorDiff.tsx for unit testing ──────────

type DiffToken = { text: string; kind: 'same' | 'removed' | 'added' }

function tokenize(selector: string): string[] {
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

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aTokens[i - 1] === bTokens[j - 1]) {
      oldResult.unshift({ text: aTokens[i - 1], kind: 'same' })
      newResult.unshift({ text: bTokens[j - 1], kind: 'same' })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      newResult.unshift({ text: bTokens[j - 1], kind: 'added' })
      j--
    } else {
      oldResult.unshift({ text: aTokens[i - 1], kind: 'removed' })
      i--
    }
  }

  return { old: oldResult, new: newResult }
}

// ── tokenize ─────────────────────────────────────────────────────────────────

describe('tokenize', () => {
  it('splits simple class selector', () => {
    const tokens = tokenize('#submit-btn')
    expect(tokens).toEqual(['#submit-btn'])
  })

  it('splits descendant selector on spaces', () => {
    const tokens = tokenize('div .child span')
    // leading spaces become separate tokens
    expect(tokens.join('')).toBe('div .child span')
    expect(tokens.length).toBeGreaterThan(1)
  })

  it('splits on class dots', () => {
    const tokens = tokenize('button.primary.active')
    expect(tokens).toContain('button')
    expect(tokens).toContain('.primary')
    expect(tokens).toContain('.active')
  })

  it('splits on attribute selector', () => {
    const tokens = tokenize('input[type="text"]')
    expect(tokens.join('')).toBe('input[type="text"]')
    expect(tokens.length).toBeGreaterThan(1)
  })

  it('returns original string if no delimiters', () => {
    expect(tokenize('simpleTag')).toEqual(['simpleTag'])
  })

  it('filters empty tokens', () => {
    const tokens = tokenize('  ')
    expect(tokens.every(t => t.length > 0)).toBe(true)
  })
})

// ── lcs ──────────────────────────────────────────────────────────────────────

describe('lcs', () => {
  it('identical arrays → full length', () => {
    const a = ['a', 'b', 'c']
    const dp = lcs(a, a)
    expect(dp[a.length][a.length]).toBe(3)
  })

  it('completely different arrays → 0', () => {
    const dp = lcs(['x', 'y'], ['a', 'b'])
    expect(dp[2][2]).toBe(0)
  })

  it('partial overlap', () => {
    const dp = lcs(['a', 'b', 'c'], ['b', 'c', 'd'])
    expect(dp[3][3]).toBe(2)
  })

  it('empty arrays', () => {
    const dp = lcs([], [])
    expect(dp[0][0]).toBe(0)
  })
})

// ── computeDiff ──────────────────────────────────────────────────────────────

describe('computeDiff', () => {
  it('identical selectors → all same', () => {
    const result = computeDiff('#login-btn', '#login-btn')
    expect(result.old.every(t => t.kind === 'same')).toBe(true)
    expect(result.new.every(t => t.kind === 'same')).toBe(true)
  })

  it('completely replaced selector → all removed/added', () => {
    const result = computeDiff('div', 'span')
    expect(result.old.some(t => t.kind === 'removed')).toBe(true)
    expect(result.new.some(t => t.kind === 'added')).toBe(true)
    expect(result.old.every(t => t.kind !== 'same')).toBe(true)
  })

  it('one token added creates added entry in new diff', () => {
    const result = computeDiff('button', 'button.primary')
    const addedCount = result.new.filter(t => t.kind === 'added').length
    expect(addedCount).toBeGreaterThan(0)
  })

  it('one token removed creates removed entry in old diff', () => {
    const result = computeDiff('button.primary', 'button')
    const removedCount = result.old.filter(t => t.kind === 'removed').length
    expect(removedCount).toBeGreaterThan(0)
  })

  it('reconstructs old selector from tokens', () => {
    const old = '#login-btn'
    const result = computeDiff(old, '#submit-btn')
    const reconstructed = result.old.map(t => t.text).join('')
    expect(reconstructed).toBe(old)
  })

  it('reconstructs new selector from tokens', () => {
    const newSel = '#submit-btn'
    const result = computeDiff('#login-btn', newSel)
    const reconstructed = result.new.map(t => t.text).join('')
    expect(reconstructed).toBe(newSel)
  })

  it('complex CSS selectors produce plausible diff', () => {
    const result = computeDiff(
      'div.container > ul.list > li.item > a',
      'div.container > ul.nav-list > li > a'
    )
    // Both results must reconstruct their source
    const oldStr = result.old.map(t => t.text).join('')
    const newStr = result.new.map(t => t.text).join('')
    expect(oldStr).toBe('div.container > ul.list > li.item > a')
    expect(newStr).toBe('div.container > ul.nav-list > li > a')
  })
})
