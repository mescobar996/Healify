/**
 * GET  /api/projects/[id]/github-actions-workflow
 *
 * Returns a ready-to-use GitHub Actions YAML workflow file that calls the
 * Healify API to trigger a test run whenever code is pushed to the main or
 * staging branches.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { db } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

function buildWorkflow(projectId: string, appUrl: string): string {
  return `# Healify — auto-generated workflow
# Place this file at .github/workflows/healify.yml in your repository.
name: Healify Test Run

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

jobs:
  healify:
    name: Run Healify Tests
    runs-on: ubuntu-latest

    steps:
      - name: Trigger Healify test run
        run: |
          curl -X POST \\
            -H "Authorization: Bearer \${{ secrets.HEALIFY_API_KEY }}" \\
            -H "Content-Type: application/json" \\
            -d '{"branch":"${{ github.ref_name }}","commitSha":"${{ github.sha }}","commitMessage":"${{ github.event.head_commit.message }}","commitAuthor":"${{ github.actor }}"}' \\
            ${appUrl}/api/projects/${projectId}/run

# ──────────────────────────────────────────────────────────────────────────────
# Setup instructions:
# 1. In your GitHub repo → Settings → Secrets and variables → Actions
#    create a secret called HEALIFY_API_KEY with your Healify API key.
# 2. Commit this file to .github/workflows/healify.yml
# 3. Each push to main/staging will trigger a Healify test run automatically.
# ──────────────────────────────────────────────────────────────────────────────
`
}

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionUser()
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: projectId } = await params

  const project = await db.project.findFirst({
    where: { id: projectId, userId: user.id },
    select: { id: true, name: true },
  })

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    'https://your-healify-instance.com'

  const yaml = buildWorkflow(projectId, appUrl)

  return new NextResponse(yaml, {
    status: 200,
    headers: {
      'Content-Type': 'text/yaml; charset=utf-8',
      'Content-Disposition': `attachment; filename="healify.yml"`,
    },
  })
}
