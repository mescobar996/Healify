import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function getBadgeColor(healingRate: number): string {
  if (healingRate >= 95) return '#34D399'
  if (healingRate >= 85) return '#60A5FA'
  if (healingRate >= 70) return '#FBBF24'
  return '#F87171'
}

function buildBadgeSvg(label: string, value: string, color: string): string {
  const safeLabel = escapeXml(label)
  const safeValue = escapeXml(value)

  const labelWidth = Math.max(86, 7 * safeLabel.length + 20)
  const valueWidth = Math.max(70, 7 * safeValue.length + 18)
  const totalWidth = labelWidth + valueWidth

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${safeLabel}: ${safeValue}">
  <defs>
    <linearGradient id="g" x2="0" y2="100%">
      <stop offset="0" stop-color="#fff" stop-opacity=".08"/>
      <stop offset="1" stop-opacity=".08"/>
    </linearGradient>
  </defs>
  <rect width="${totalWidth}" height="20" fill="#0F0F13" rx="4"/>
  <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}" rx="4"/>
  <rect width="${totalWidth}" height="20" fill="url(#g)" rx="4"/>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11">
    <text x="${Math.floor(labelWidth / 2)}" y="15" fill="#F0F0F4">${safeLabel}</text>
    <text x="${labelWidth + Math.floor(valueWidth / 2)}" y="15">${safeValue}</text>
  </g>
</svg>`
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const url = new URL(request.url)
    const range = url.searchParams.get('range') || '30d'
    const style = url.searchParams.get('style') || 'healed'

    const days = range === '7d' ? 7 : 30
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true },
    })

    if (!project) {
      const svg = buildBadgeSvg('healify', 'project not found', '#F87171')
      return new NextResponse(svg, {
        status: 404,
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      })
    }

    const [healingTotal, healingSuccess, autoPrCount] = await Promise.all([
      db.healingEvent.count({
        where: {
          testRun: { projectId },
          createdAt: { gte: from },
        },
      }),
      db.healingEvent.count({
        where: {
          testRun: { projectId },
          createdAt: { gte: from },
          status: { in: ['HEALED_AUTO', 'HEALED_MANUAL'] },
        },
      }),
      db.healingEvent.count({
        where: {
          testRun: { projectId },
          createdAt: { gte: from },
          prUrl: { not: null },
        },
      }),
    ])

    const healingRate = healingTotal > 0 ? Math.round((healingSuccess / healingTotal) * 100) : 0

    let label = 'healed by healify'
    let value = `${healingRate}%`
    let color = getBadgeColor(healingRate)

    if (style === 'prs') {
      label = 'healify auto-prs'
      value = `${autoPrCount}`
      color = autoPrCount > 0 ? '#34D399' : '#6B7280'
    }

    if (style === 'events') {
      label = `healify ${days}d events`
      value = `${healingTotal}`
      color = healingTotal > 0 ? '#60A5FA' : '#6B7280'
    }

    const svg = buildBadgeSvg(label, value, color)

    return new NextResponse(svg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    })
  } catch (error) {
    console.error('[BADGE] Error generating badge:', error)
    const svg = buildBadgeSvg('healify', 'badge error', '#F87171')
    return new NextResponse(svg, {
      status: 500,
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  }
}
