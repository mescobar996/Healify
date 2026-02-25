import { describe, it, expect } from 'vitest'
import { formatNumber, formatRelativeTime, formatDuration } from '@/lib/api'

// ── Tests de funciones puras — sin mocks, sin DB, sin red ─────────────

describe('formatNumber', () => {
  it('0 → "0"', ()         => expect(formatNumber(0)).toBe('0'))
  it('999 → "999"', ()     => expect(formatNumber(999)).toBe('999'))
  it('1000 → "1.0K"', ()   => expect(formatNumber(1000)).toBe('1.0K'))
  it('1500 → "1.5K"', ()   => expect(formatNumber(1500)).toBe('1.5K'))
  it('1000000 → "1.0M"', ()=> expect(formatNumber(1_000_000)).toBe('1.0M'))
  it('2500000 → "2.5M"', ()=> expect(formatNumber(2_500_000)).toBe('2.5M'))
  it('siempre retorna string', () => expect(typeof formatNumber(42)).toBe('string'))
})

describe('formatRelativeTime', () => {
  const ago = (ms: number) => new Date(Date.now() - ms).toISOString()

  it('30 segundos → "just now"', () =>
    expect(formatRelativeTime(ago(30_000))).toBe('just now'))

  it('5 minutos → "5m ago"', () =>
    expect(formatRelativeTime(ago(5 * 60_000))).toBe('5m ago'))

  it('2 horas → "2h ago"', () =>
    expect(formatRelativeTime(ago(2 * 3_600_000))).toBe('2h ago'))

  it('3 días → "3d ago"', () =>
    expect(formatRelativeTime(ago(3 * 86_400_000))).toBe('3d ago'))

  it('acepta objeto Date además de string', () => {
    const d = new Date(Date.now() - 60_000)
    expect(formatRelativeTime(d)).toBe('1m ago')
  })

  it('siempre retorna string', () =>
    expect(typeof formatRelativeTime(ago(1000))).toBe('string'))
})

describe('formatDuration', () => {
  it('500ms → "500ms"',    () => expect(formatDuration(500)).toBe('500ms'))
  it('1000ms → "1.0s"',   () => expect(formatDuration(1000)).toBe('1.0s'))
  it('30000ms → "30.0s"', () => expect(formatDuration(30_000)).toBe('30.0s'))
  it('90000ms → "1m 30s"',() => expect(formatDuration(90_000)).toBe('1m 30s'))
  it('2min 5s',            () => expect(formatDuration(125_000)).toBe('2m 5s'))
})
