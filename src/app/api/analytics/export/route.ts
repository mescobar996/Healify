import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { analyticsService } from '@/lib/analytics-service'

function escapePdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function buildSimplePdf(lines: string[]): string {
  const contentLines = [
    'BT',
    '/F1 12 Tf',
    '50 760 Td',
    ...lines.flatMap((line, index) => {
      if (index === 0) return [`(${escapePdfText(line)}) Tj`]
      return ['0 -22 Td', `(${escapePdfText(line)}) Tj`]
    }),
    'ET',
  ]

  const streamContent = contentLines.join('\n')

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${Buffer.byteLength(streamContent, 'utf8')} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ]

  let pdf = '%PDF-1.4\n'
  const xrefOffsets: number[] = [0]

  for (const object of objects) {
    xrefOffsets.push(Buffer.byteLength(pdf, 'utf8'))
    pdf += object
  }

  const xrefStart = Buffer.byteLength(pdf, 'utf8')
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  for (let i = 1; i < xrefOffsets.length; i++) {
    pdf += `${String(xrefOffsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`

  return pdf
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const format = (searchParams.get('format') || 'csv').toLowerCase()

    const roi = await analyticsService.getGlobalStats(session.user.id)
    const generatedAt = new Date().toISOString()

    if (format === 'pdf') {
      const lines = [
        'Healify - ROI Report',
        `Generated at: ${generatedAt}`,
        `Total hours saved: ${roi.timeSavedHours}`,
        `Estimated cost saved: $${roi.totalCostSaved}`,
        `Auto-healed (month): ${roi.autoHealedMonth}`,
        `Bugs detected (month): ${roi.bugsDetectedMonth}`,
        `Healing rate (month): ${roi.healingRate}%`,
        `Healed today: ${roi.healedToday}`,
      ]

      const pdfBytes = buildSimplePdf(lines)
      return new NextResponse(pdfBytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="healify-roi-${new Date().toISOString().slice(0, 10)}.pdf"`,
        },
      })
    }

    const csvRows = [
      ['metric', 'value'],
      ['generated_at', generatedAt],
      ['time_saved_hours', String(roi.timeSavedHours)],
      ['total_cost_saved_usd', String(roi.totalCostSaved)],
      ['auto_healed_month', String(roi.autoHealedMonth)],
      ['bugs_detected_month', String(roi.bugsDetectedMonth)],
      ['healing_rate_month_percent', String(roi.healingRate)],
      ['healed_today', String(roi.healedToday)],
    ]

    const csv = csvRows.map((row) => row.map((column) => `"${String(column).replace(/"/g, '""')}"`).join(',')).join('\n')

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="healify-roi-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (error) {
    console.error('[ANALYTICS][EXPORT] Error:', error)
    return NextResponse.json({ error: 'Failed to export ROI' }, { status: 500 })
  }
}
