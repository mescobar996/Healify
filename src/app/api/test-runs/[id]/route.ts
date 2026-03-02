import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionUser } from '@/lib/auth/session';

// GET /api/test-runs/:id - Get test run details with healing events
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params;

    const testRun = await db.testRun.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            description: true,
            repository: true,
            userId: true,
          },
        },
        healingEvents: {
          orderBy: { createdAt: 'desc' },
        },
        screenshots: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!testRun) {
      return NextResponse.json({ error: 'Test run not found' }, { status: 404 });
    }

    // Verify ownership
    if (testRun.project.userId !== user.id) {
      return NextResponse.json({ error: 'Test run not found' }, { status: 404 });
    }

    // Calculate statistics
    const healingStats = {
      total: testRun.healingEvents.length,
      autoHealed: testRun.healingEvents.filter((e) => e.status === 'HEALED_AUTO').length,
      manualHealed: testRun.healingEvents.filter((e) => e.status === 'HEALED_MANUAL').length,
      needsReview: testRun.healingEvents.filter((e) => e.status === 'NEEDS_REVIEW').length,
      bugDetected: testRun.healingEvents.filter((e) => e.status === 'BUG_DETECTED').length,
      ignored: testRun.healingEvents.filter((e) => e.status === 'IGNORED').length,
    };

    return NextResponse.json({
      ...testRun,
      healingStats,
    });
  } catch (error) {
    console.error('Error fetching test run:', error);
    return NextResponse.json(
      { error: 'Failed to fetch test run' },
      { status: 500 }
    );
  }
}
