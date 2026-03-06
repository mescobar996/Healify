import { NextRequest, NextResponse } from 'next/server';
import { tryOpenAutoPR } from '@/lib/github/auto-pr';
import { db } from '@/lib/db';
import Anthropic from '@anthropic-ai/sdk';
import { SelectorType, HealingStatus } from '@/lib/enums';
import { notificationService } from '@/lib/notification-service';
import { getSessionUser } from '@/lib/auth/session';

interface HealRequestBody {
  testName: string;
  testFile?: string;
  failedSelector: string;
  selectorType: SelectorType;
  errorMessage: string;
  stackTrace?: string;
  oldDomSnapshot?: string;
  newDomSnapshot?: string;
  screenshotBefore?: string;
  screenshotAfter?: string;
}

// POST /api/test-runs/:id/heal - Trigger healing analysis for a test run
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser()
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params;
    const body: HealRequestBody = await request.json();

    const {
      testName,
      testFile,
      failedSelector,
      selectorType,
      errorMessage,
      stackTrace,
      oldDomSnapshot,
      newDomSnapshot,
      screenshotBefore,
      screenshotAfter,
    } = body;

    // Validate required fields
    if (!testName || !failedSelector || !errorMessage) {
      return NextResponse.json(
        { error: 'Missing required fields: testName, failedSelector, errorMessage' },
        { status: 400 }
      );
    }

    // Verify test run exists
    const testRun = await db.testRun.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!testRun) {
      return NextResponse.json({ error: 'Test run not found' }, { status: 404 });
    }

    // Verify ownership
    if (testRun.project.userId !== user.id) {
      return NextResponse.json({ error: 'Test run not found' }, { status: 404 });
    }

    // Create initial healing event
    const healingEvent = await db.healingEvent.create({
      data: {
        testRunId: id,
        testName,
        testFile: testFile || null,
        failedSelector,
        selectorType: selectorType || 'UNKNOWN',
        errorMessage,
        stackTrace: stackTrace || null,
        oldDomSnapshot: oldDomSnapshot || null,
        newDomSnapshot: newDomSnapshot || null,
        screenshotBefore: screenshotBefore || null,
        screenshotAfter: screenshotAfter || null,
        status: 'ANALYZING',
      },
    });

    try {
      let message: Anthropic.Messages.Message | null = null;
      let retries = 0;
      const maxRetries = 3;

      while (retries < maxRetries) {
        try {
          const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

          let imageContext = '';
          const userMessages: Anthropic.MessageParam[] = [];

          const analysisPrompt = `You are a test healing expert analyzing a failed test. Your job is to determine if this is a flaky test, a real bug, or a selector change that can be auto-fixed.

**Test Information:**
- Test Name: ${testName}
- Test File: ${testFile || 'Unknown'}
- Failed Selector: ${failedSelector}
- Selector Type: ${selectorType}
- Error Message: ${errorMessage}
${stackTrace ? `- Stack Trace:\n\`\`\`\n${stackTrace}\n\`\`\`` : ''}

${oldDomSnapshot ? `**Old DOM Snapshot (before change):**\n\`\`\`html\n${oldDomSnapshot.substring(0, 5000)}\n\`\`\`` : ''}
${newDomSnapshot ? `**New DOM Snapshot (current):**\n\`\`\`html\n${newDomSnapshot.substring(0, 5000)}\n\`\`\`` : ''}

Analyze this failure and provide:
1. A confidence score (0-1) for whether this can be auto-fixed
2. A suggested new selector (if applicable)
3. The type of the new selector (CSS, XPATH, TESTID, ROLE, TEXT, or UNKNOWN)
4. Your reasoning for the analysis
5. Recommended action: AUTO_FIX (confidence > 0.95), SUGGEST (confidence 0.5-0.95), BUG_REPORT (confidence < 0.5 and appears to be a real bug), or IGNORE (legitimate UI change)

Respond ONLY with valid JSON (no markdown):
{
  "confidence": <number>,
  "newSelector": "<string or null>",
  "newSelectorType": "<CSS|XPATH|TESTID|ROLE|TEXT|UNKNOWN>",
  "reasoning": "<string>",
  "recommendedAction": "<AUTO_FIX|SUGGEST|BUG_REPORT|IGNORE>"
}`;

          userMessages.push({ role: 'user', content: [{ type: 'text', text: analysisPrompt }] });

          // Multimodal: If Base64 image is provided, pass it to Claude visually.
          if (screenshotBefore && screenshotBefore.startsWith('data:image/')) {
            const base64Data = screenshotBefore.split(',')[1];
            let mediaType = 'image/png';
            if (screenshotBefore.includes('jpeg') || screenshotBefore.includes('jpg')) mediaType = 'image/jpeg';
            if (screenshotBefore.includes('webp')) mediaType = 'image/webp';

            if (base64Data) {
              userMessages.push({
                role: 'user',
                content: [
                  {
                    type: 'image',
                    source: { type: 'base64', media_type: mediaType as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif', data: base64Data }
                  },
                  { type: 'text', text: 'Evaluate this visual capture of the failure scene as well.' }
                ]
              });
            }
          }

          message = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 512,
            temperature: 0.3,
            system: 'You are a test healing expert. Always respond with valid JSON only, no markdown.',
            messages: userMessages,
          });

          break; // success, break out of retry loop
        } catch (err: any) {
          retries++;
          if (err?.status === 429 || retries < maxRetries) {
            console.warn(`[Heal API] Rate limit hit or AI failed. Retrying ${retries}/${maxRetries} in ${retries * 1500}ms`);
            await new Promise(r => setTimeout(r, retries * 1500)); // Exponential-ish backoff
          } else {
            throw err;
          }
        }
      }

      if (!message) {
        throw new Error('Failed to retrieve analysis from AI after retries.');
      }

      const responseBlock = message.content[0];
      const responseContent = responseBlock?.type === 'text' ? responseBlock.text : null;

      if (responseContent) {
        // Parse AI response
        let analysisResult;
        try {
          // Extract JSON from response (handle markdown code blocks)
          const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            analysisResult = JSON.parse(jsonMatch[0]);
          }
        } catch {
          console.error('Failed to parse AI response as JSON');
        }

        if (analysisResult) {
          // Determine healing status based on confidence and recommended action
          let healingStatus: HealingStatus = 'NEEDS_REVIEW';
          let actionTaken: string | null = null;

          if (analysisResult.confidence >= 0.95 && analysisResult.recommendedAction === 'AUTO_FIX') {
            healingStatus = 'HEALED_AUTO';
            actionTaken = 'auto_fixed';
          } else if (analysisResult.confidence >= 0.5 && analysisResult.newSelector) {
            healingStatus = 'NEEDS_REVIEW';
            actionTaken = 'suggested';
          } else if (analysisResult.recommendedAction === 'BUG_REPORT') {
            healingStatus = 'BUG_DETECTED';
            actionTaken = 'ticket_created';
          } else if (analysisResult.recommendedAction === 'IGNORE') {
            healingStatus = 'REMOVED_LEGIT';
            actionTaken = 'ignored';
          }

          // Update healing event with analysis results
          const updatedEvent = await db.healingEvent.update({
            where: { id: healingEvent.id },
            data: {
              newSelector: analysisResult.newSelector || null,
              newSelectorType: analysisResult.newSelectorType as SelectorType || null,
              confidence: analysisResult.confidence,
              reasoning: analysisResult.reasoning,
              status: healingStatus,
              actionTaken,
              appliedAt: healingStatus === 'HEALED_AUTO' ? new Date() : null,
              appliedBy: healingStatus === 'HEALED_AUTO' ? 'system' : null,
            },
          });

          // Update test run stats
          if (healingStatus === 'HEALED_AUTO') {
            await db.testRun.update({
              where: { id },
              data: {
                healedTests: { increment: 1 },
                failedTests: { increment: 1 },
              },
            });

            // ── Bloque 8: Auto-PR cuando confidence >= 0.95 ────────────
            // Se ejecuta async para no bloquear la respuesta
            tryOpenAutoPR(updatedEvent.id).then(result => {
              if (result.opened) {
                console.log(`[Auto-PR] PR abierto: ${result.prUrl}`)
              } else {
                console.log(`[Auto-PR] No abierto: ${result.reason}`)
              }
            }).catch(err => console.error('[Auto-PR] Error async:', err))
          }

          if (healingStatus === 'HEALED_AUTO') {
            await db.notification.create({
              data: {
                userId: testRun.project.userId,
                type: 'info',
                title: 'analytics_event:onboarding_step_3_first_healing',
                message: JSON.stringify({ testRunId: id, healingEventId: updatedEvent.id }),
                link: '/dashboard/healing',
              },
            }).catch(() => { })
          }

          if (healingStatus === 'BUG_DETECTED') {
            notificationService.notifyBugDetected(
              testRun.projectId,
              testName,
              errorMessage,
              testRun.branch
            ).catch((error) => {
              console.error('[JIRA][BUG_DETECTED] Notification failed:', error)
            })
          }

          return NextResponse.json({
            success: true,
            healingEvent: updatedEvent,
            analysis: analysisResult,
            autoPR: healingStatus === 'HEALED_AUTO' ? 'triggered' : 'skipped',
          });
        }
      }

      // If AI analysis failed, mark as needs review
      const updatedEvent = await db.healingEvent.update({
        where: { id: healingEvent.id },
        data: {
          status: 'NEEDS_REVIEW',
          reasoning: 'Automated analysis could not determine a fix. Manual review required.',
        },
      });

      return NextResponse.json({
        success: true,
        healingEvent: updatedEvent,
        message: 'Analysis completed, but manual review is required.',
      });
    } catch (aiError) {
      console.error('AI analysis failed:', aiError);

      // Update event to failed status
      await db.healingEvent.update({
        where: { id: healingEvent.id },
        data: {
          status: 'FAILED',
          reasoning: `AI analysis failed: ${aiError instanceof Error ? aiError.message : 'Unknown error'}`,
        },
      });

      return NextResponse.json({
        success: false,
        error: 'AI analysis failed',
        healingEventId: healingEvent.id,
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in healing analysis:', error);
    return NextResponse.json(
      { error: 'Failed to perform healing analysis' },
      { status: 500 }
    );
  }
}
