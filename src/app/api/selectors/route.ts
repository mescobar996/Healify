import { NextRequest, NextResponse } from 'next/server'
import { selectorAnalyzer } from '@/lib/selector-analyzer'
import { getSessionUser } from '@/lib/auth/session'
import { db } from '@/lib/db'

export async function GET(request: Request) {
    try {
        const user = await getSessionUser()
        if (!user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const projectId = searchParams.get('projectId')

        if (!projectId) {
            return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
        }

        // Verify project ownership
        const project = await db.project.findUnique({
            where: { id: projectId, userId: user.id }
        })

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 })
        }

        const selectors = await selectorAnalyzer.analyzeProject(projectId)

        return NextResponse.json(selectors)
    } catch (error) {
        console.error('Error analyzing selectors:', error)
        return NextResponse.json(
            { error: 'Failed to analyze selectors' },
            { status: 500 }
        )
    }
}
