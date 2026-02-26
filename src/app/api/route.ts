import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    name: 'Healify API',
    version: '1.0',
    docs: 'https://healify-sigma.vercel.app/docs',
    endpoints: {
      report:   'POST /api/v1/report',
      projects: 'GET  /api/projects',
      testRuns: 'GET  /api/test-runs',
      healing:  'GET  /api/healing-events',
    },
  })
}
