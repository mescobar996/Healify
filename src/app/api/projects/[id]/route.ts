import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { auditLogService } from '@/lib/audit-log-service';

// GET /api/projects/:id - Get project details with test runs
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params;

    const project = await db.project.findUnique({
      where: { id, userId: session.user.id },
      include: {
        testRuns: {
          take: 20,
          orderBy: { startedAt: 'desc' },
        },
        selectors: {
          take: 50,
          orderBy: { lastSeen: 'desc' },
        },
        _count: {
          select: {
            testRuns: true,
            selectors: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/:id - Delete a project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params;

    const project = await db.project.findUnique({
      where: { id, userId: session.user.id },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    await db.project.delete({
      where: { id, userId: session.user.id },
    });

    await auditLogService.log(session.user.id, 'PROJECT_DELETE', id, {
      name: project.name
    })

    return NextResponse.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/:id - Update project name/description/repository
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const project = await db.project.findUnique({
      where: { id, userId: session.user.id },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, description, repository, framework } = body

    // Validate at least one field is being updated
    if (!name && !description && !repository && !framework) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const updated = await db.project.update({
      where: { id, userId: session.user.id },
      data: {
        ...(name        && { name: String(name).trim() }),
        ...(description !== undefined && { description: description ? String(description).trim() : null }),
        ...(repository  && { repository: String(repository).trim() }),
        ...(framework   && { framework: String(framework).trim() }),
      },
    })

    await auditLogService.log(session.user.id, 'PROJECT_UPDATE', id, {
      name: updated.name,
      fields: Object.keys(body).filter(k => ['name','description','repository','framework'].includes(k)),
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating project:', error)
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    )
  }
}
