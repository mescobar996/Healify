import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { HealingStatus } from '@prisma/client';

// PATCH /api/healing-events/:id - Update healing event (accept/reject suggestion)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, appliedBy } = body;

    // Validate action
    const validActions = ['accept', 'reject', 'ignore', 'mark_bug'];
    if (!action || !validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    // Find the healing event
    const healingEvent = await db.healingEvent.findUnique({
      where: { id },
      include: {
        testRun: true,
      },
    });

    if (!healingEvent) {
      return NextResponse.json({ error: 'Healing event not found' }, { status: 404 });
    }

    // Determine new status based on action
    let newStatus: HealingStatus;
    let actionTaken: string;

    switch (action) {
      case 'accept':
        if (!healingEvent.newSelector) {
          return NextResponse.json(
            { error: 'No suggestion available to accept' },
            { status: 400 }
          );
        }
        newStatus = 'HEALED_MANUAL';
        actionTaken = 'manual_fix';
        break;
      case 'reject':
        newStatus = 'BUG_DETECTED';
        actionTaken = 'rejected_suggestion';
        break;
      case 'ignore':
        newStatus = 'IGNORED';
        actionTaken = 'ignored';
        break;
      case 'mark_bug':
        newStatus = 'BUG_DETECTED';
        actionTaken = 'marked_as_bug';
        break;
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Update the healing event
    const updatedEvent = await db.healingEvent.update({
      where: { id },
      data: {
        status: newStatus,
        actionTaken,
        appliedAt: new Date(),
        appliedBy: appliedBy || 'user',
      },
    });

    // Update test run stats if accepted
    if (action === 'accept') {
      await db.testRun.update({
        where: { id: healingEvent.testRunId },
        data: {
          healedTests: { increment: 1 },
        },
      });

      // Update or create tracked selector
      if (healingEvent.newSelector && healingEvent.testRun.projectId) {
        const existingSelector = await db.trackedSelector.findFirst({
          where: {
            projectId: healingEvent.testRun.projectId,
            selector: healingEvent.failedSelector,
          },
        });

        if (existingSelector) {
          await db.trackedSelector.update({
            where: { id: existingSelector.id },
            data: {
              selector: healingEvent.newSelector,
              timesHealed: { increment: 1 },
              lastHealed: new Date(),
              robustness: Math.min(1, existingSelector.robustness + 0.1),
            },
          });
        } else {
          await db.trackedSelector.create({
            data: {
              projectId: healingEvent.testRun.projectId,
              selector: healingEvent.newSelector,
              type: healingEvent.newSelectorType || 'UNKNOWN',
              file: healingEvent.testFile || 'unknown',
              line: 0,
              timesHealed: 1,
              lastHealed: new Date(),
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      healingEvent: updatedEvent,
      message: `Healing event ${action}ed successfully`,
    });
  } catch (error) {
    console.error('Error updating healing event:', error);
    return NextResponse.json(
      { error: 'Failed to update healing event' },
      { status: 500 }
    );
  }
}
