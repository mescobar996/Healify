import { NextResponse } from 'next/server'
import { analyticsService } from '@/lib/analytics-service'
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
            // Return global stats for THIS user
            const stats = await analyticsService.getGlobalStats(user.id)
            return NextResponse.json(stats)
        }

        // Verify project belongs to user
        const project = await db.project.findUnique({
            where: { id: projectId, userId: user.id }
        })

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 })
        }

        const analytics = await analyticsService.getProjectAnalytics(projectId)
        return NextResponse.json(analytics)
    } catch (error) {
        console.error('Error fetching analytics:', error)
        return NextResponse.json(
            { error: 'Failed to fetch analytics' },
            { status: 500 }
        )
    }
}
