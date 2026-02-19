import { NextRequest, NextResponse } from 'next/server'
import { selectorAnalyzer } from '@/lib/selector-analyzer'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { db } from '@/lib/db'

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const projectId = searchParams.get('projectId')

        if (!projectId) {
            return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
        }

        // Verify project ownership
        const project = await db.project.findUnique({
            where: { id: projectId, userId: session.user.id }
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
