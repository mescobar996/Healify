import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { auditLogService } from '@/lib/audit-log-service';
import { getSessionUser } from '@/lib/auth/session';
import { apiError } from '@/lib/api-response';

// GET /api/projects/:id - Get project details with test runs
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser()
    if (!user?.id) {
      return apiError(request, 401, 'Unauthorized', { code: 'AUTH_REQUIRED' })
    }

    const { id } = await params;

    const project = await db.project.findFirst({
      where: { id, userId: user.id },
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
      return apiError(request, 404, 'Project not found', { code: 'PROJECT_NOT_FOUND' });
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    return apiError(request, 500, 'Failed to fetch project', { code: 'PROJECT_FETCH_FAILED' });
  }
}

// DELETE /api/projects/:id - Delete a project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser()
    if (!user?.id) {
      return apiError(request, 401, 'Unauthorized', { code: 'AUTH_REQUIRED' })
    }

    const { id } = await params;

    const project = await db.project.findFirst({
      where: { id, userId: user.id },
    });

    if (!project) {
      return apiError(request, 404, 'Project not found', { code: 'PROJECT_NOT_FOUND' });
    }

    await db.$transaction(async (tx) => {
      await tx.analyticsEvent.deleteMany({
        where: { projectId: id },
      })

      await tx.project.delete({
        where: { id },
      });
    })

    await auditLogService.log(user.id, 'PROJECT_DELETE', id, {
      name: project.name
    })

    return NextResponse.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    return apiError(request, 500, 'Failed to delete project', {
      code: 'PROJECT_DELETE_FAILED',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

// PATCH /api/projects/:id - Update project name/description/repository
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser()
    if (!user?.id) {
      return apiError(request, 401, 'Unauthorized', { code: 'AUTH_REQUIRED' })
    }

    const { id } = await params

    const project = await db.project.findFirst({
      where: { id, userId: user.id },
    })

    if (!project) {
      return apiError(request, 404, 'Project not found', { code: 'PROJECT_NOT_FOUND' })
    }

    const body = await request.json()
    const { name, description, repository, framework } = body

    // Validate at least one field is being updated
    if (!name && !description && !repository && !framework) {
      return apiError(request, 400, 'No fields to update', { code: 'NO_UPDATE_FIELDS' })
    }

    const updated = await db.project.update({
      where: { id },
      data: {
        ...(name        && { name: String(name).trim() }),
        ...(description !== undefined && { description: description ? String(description).trim() : null }),
        ...(repository  && { repository: String(repository).trim() }),
        ...(framework   && { framework: String(framework).trim() }),
      },
    })

    await auditLogService.log(user.id, 'PROJECT_UPDATE', id, {
      name: updated.name,
      fields: Object.keys(body).filter(k => ['name','description','repository','framework'].includes(k)),
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Error updating project:', error)
    return apiError(request, 500, 'Failed to update project', { code: 'PROJECT_UPDATE_FAILED' })
  }
}
