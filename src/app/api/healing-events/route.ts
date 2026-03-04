import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { HealingStatus } from '@/lib/enums';
import { getSessionUser } from '@/lib/auth/session';

// GET /api/healing-events - List healing events
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const testRunId = searchParams.get('testRunId');
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status') as HealingStatus | null;
    const needsReview = searchParams.get('needsReview') === 'true';

    const where: {
      testRunId?: string;
      status?: HealingStatus;
      testRun?: { projectId?: string; project?: { userId: string } };
    } = {
      testRun: { project: { userId: user.id } }
    };

    if (testRunId) {
      where.testRunId = testRunId;
    }
    if (projectId) {
      where.testRun = { ...where.testRun, projectId };
    }
    if (status && Object.values(HealingStatus).includes(status)) {
      where.status = status;
    }
    if (needsReview) {
      where.status = 'NEEDS_REVIEW';
    }

    const healingEvents = await db.healingEvent.findMany({
      where,
      take: limit,
      skip: offset,
      include: {
        testRun: {
          select: {
            id: true,
            branch: true,
            startedAt: true,
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const total = await db.healingEvent.count({ where });

    // Get summary statistics — scoped to current user
    const stats = await db.healingEvent.groupBy({
      by: ['status'],
      where,
      _count: true,
    });

    const statusCounts = Object.fromEntries(
      stats.map((s) => [s.status, s._count])
    );

    return NextResponse.json({
      healingEvents,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      stats: {
        total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
        analyzing: statusCounts['ANALYZING'] || 0,
        healedAuto: statusCounts['HEALED_AUTO'] || 0,
        healedManual: statusCounts['HEALED_MANUAL'] || 0,
        needsReview: statusCounts['NEEDS_REVIEW'] || 0,
        bugDetected: statusCounts['BUG_DETECTED'] || 0,
        ignored: statusCounts['IGNORED'] || 0,
        failed: statusCounts['FAILED'] || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching healing events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch healing events' },
      { status: 500 }
    );
  }
}
