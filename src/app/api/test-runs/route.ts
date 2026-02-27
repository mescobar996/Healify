import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { TestStatus } from '@/lib/enums';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { checkTestRunLimit, limitExceededResponse } from '@/lib/rate-limit';

// GET /api/test-runs - List test runs with filters
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const projectId = searchParams.get('projectId');
    const status = searchParams.get('status') as TestStatus | null;
    const branch = searchParams.get('branch');
    const q = searchParams.get('q')?.trim();

    const where: {
      projectId?: string;
      status?: TestStatus;
      branch?: string;
      project?: { userId: string };
      OR?: Array<{
        branch?: { contains: string; mode: 'insensitive' }
        commitMessage?: { contains: string; mode: 'insensitive' }
        commitSha?: { contains: string; mode: 'insensitive' }
        project?: { name?: { contains: string; mode: 'insensitive' } }
        healingEvents?: { some: { testName: { contains: string; mode: 'insensitive' } } }
      }>;
    } = {
      project: { userId: session.user.id }
    };

    if (projectId) {
      where.projectId = projectId;
    }
    if (status && Object.values(TestStatus).includes(status)) {
      where.status = status;
    }
    if (branch) {
      where.branch = branch;
    }
    if (q) {
      where.OR = [
        { branch: { contains: q, mode: 'insensitive' } },
        { commitMessage: { contains: q, mode: 'insensitive' } },
        { commitSha: { contains: q, mode: 'insensitive' } },
        { project: { name: { contains: q, mode: 'insensitive' } } },
        { healingEvents: { some: { testName: { contains: q, mode: 'insensitive' } } } },
      ]
    }

    const testRuns = await db.testRun.findMany({
      where,
      take: limit,
      skip: offset,
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            healingEvents: true,
          },
        },
      },
      orderBy: {
        startedAt: 'desc',
      },
    });

    const total = await db.testRun.count({ where });

    return NextResponse.json({
      testRuns,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('Error fetching test runs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch test runs' },
      { status: 500 }
    );
  }
}

// POST /api/test-runs - Create a new test run
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json();
    const {
      projectId,
      branch,
      commitSha,
      commitMessage,
      triggeredBy,
      totalTests,
    } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const project = await db.project.findUnique({
      where: { id: projectId, userId: session.user.id },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // ── Bloque 9: Rate limiting por plan ──────────────────────────────
    const limitCheck = await checkTestRunLimit(session.user.id)
    if (!limitCheck.allowed) {
      return limitExceededResponse('testRuns', limitCheck)
    }

    const testRun = await db.testRun.create({
      data: {
        projectId,
        branch: branch?.trim() || null,
        commitSha: commitSha?.trim() || null,
        commitMessage: commitMessage?.trim() || null,
        triggeredBy: triggeredBy || 'manual',
        totalTests: totalTests || 0,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json(testRun, { status: 201 });
  } catch (error) {
    console.error('Error creating test run:', error);
    return NextResponse.json(
      { error: 'Failed to create test run' },
      { status: 500 }
    );
  }
}
