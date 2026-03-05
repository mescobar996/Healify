import { db } from '@/lib/db'
import { createSmartPR, createHealifyCheckRun } from './checks'

// ═══════════════════════════════════════════════════════════════════════
// AUTO-PR — Bloque 8
// Cuando Healify cura un test con confidence >= 0.95, abre automáticamente
// un Pull Request en el repositorio del usuario con el selector corregido.
// ═══════════════════════════════════════════════════════════════════════

const AUTO_PR_CONFIDENCE_THRESHOLD = 0.95

interface AutoPRResult {
    opened: boolean
    prUrl?: string
    prBranch?: string
    reason?: string
}

// ─── Obtener el access_token de GitHub del usuario ────────────────────
async function getGitHubToken(userId: string): Promise<string | null> {
    const account = await db.account.findFirst({
        where: { userId, provider: 'github' },
        select: { access_token: true },
    })
    return account?.access_token ?? null
}

// ─── Parsear owner/repo desde la URL del repositorio ─────────────────
function parseRepoUrl(repoUrl: string): { owner: string; repo: string } | null {
    try {
        // Soporta: https://github.com/owner/repo, github.com/owner/repo, owner/repo
        const clean = repoUrl
            .replace(/^https?:\/\//, '')
            .replace(/^github\.com\//, '')
            .replace(/\.git$/, '')
            .replace(/\/$/, '')
        const parts = clean.split('/')
        if (parts.length < 2) return null
        return { owner: parts[0], repo: parts[1] }
    } catch {
        return null
    }
}

// ─── Obtener la rama por defecto del repo ─────────────────────────────
async function getDefaultBranch(
    accessToken: string,
    owner: string,
    repo: string
): Promise<string> {
    try {
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/vnd.github+json',
            },
        })
        if (!res.ok) return 'main'
        const data = await res.json()
        return data.default_branch || 'main'
    } catch {
        return 'main'
    }
}

// ─── FUNCIÓN PRINCIPAL ─────────────────────────────────────────────────
export async function tryOpenAutoPR(healingEventId: string): Promise<AutoPRResult> {
    try {
        // 1. Cargar el healing event con toda la info necesaria
        const event = await db.healingEvent.findUnique({
            where: { id: healingEventId },
            include: {
                testRun: {
                    include: {
                        project: {
                            include: { user: true }
                        }
                    }
                }
            }
        })

        if (!event) return { opened: false, reason: 'Healing event no encontrado' }

        // 2. Verificar confidence threshold
        if (!event.confidence || event.confidence < AUTO_PR_CONFIDENCE_THRESHOLD) {
            return {
                opened: false,
                reason: `Confidence ${Math.round((event.confidence || 0) * 100)}% < ${AUTO_PR_CONFIDENCE_THRESHOLD * 100}% requerido`
            }
        }

        // 3. Verificar que hay un selector nuevo
        if (!event.newSelector) {
            return { opened: false, reason: 'No hay selector nuevo para aplicar' }
        }

        // 4. Verificar que el proyecto tiene repo configurado
        const project = event.testRun.project
        if (!project.repository) {
            return { opened: false, reason: 'Proyecto sin repositorio GitHub configurado' }
        }

        // 5. Parsear owner/repo
        const parsed = parseRepoUrl(project.repository)
        if (!parsed) {
            return { opened: false, reason: `URL de repo inválida: ${project.repository}` }
        }

        // 6. Obtener GitHub token del usuario
        const userId = project.userId
        if (!userId) return { opened: false, reason: 'Proyecto sin usuario asignado' }

        const accessToken = await getGitHubToken(userId)
        if (!accessToken) {
            return { opened: false, reason: 'Usuario sin GitHub access token (login con GitHub requerido)' }
        }

        // 7. Obtener rama por defecto
        const baseBranch = await getDefaultBranch(accessToken, parsed.owner, parsed.repo)

        // 8. Crear Smart PR (find-and-replace real en el test file + fallback a patch)
        const prResult = await createSmartPR({
            accessToken,
            owner: parsed.owner,
            repo: parsed.repo,
            baseBranch,
            testFile: event.testFile,
            oldSelector: event.failedSelector,
            newSelector: event.newSelector,
            testName: event.testName,
            confidence: event.confidence,
            reasoning: event.reasoning || '',
            healingEventId,
        })

        if (!prResult) {
            return { opened: false, reason: 'Failed to create pull request' }
        }

        // 9. Crear GitHub Check Run en el commit del PR
        await createHealifyCheckRun({
            accessToken,
            owner: parsed.owner,
            repo: parsed.repo,
            headSha: prResult.headSha,
            healingEventId,
            testName: event.testName,
            confidence: event.confidence,
            oldSelector: event.failedSelector,
            newSelector: event.newSelector,
            reasoning: event.reasoning || '',
        }).catch(err => console.warn('[Auto-PR] Check run creation failed (non-fatal):', err))

        // 10. Guardar prUrl en el HealingEvent
        await db.healingEvent.update({
            where: { id: healingEventId },
            data: {
                prUrl: prResult.prUrl,
                prBranch: prResult.branch,
            }
        })

        if (project.userId) {
            await db.notification.create({
                data: {
                    userId: project.userId,
                    type: 'success',
                    title: 'PR automático creado',
                    message: `Healify abrió un PR para "${event.testName}" (${Math.round(event.confidence * 100)}% confianza).`,
                    link: prResult.prUrl,
                },
            }).catch(() => {})
        }

        console.log(`[Auto-PR] ✅ PR abierto: ${prResult.prUrl}`)
        return { opened: true, prUrl: prResult.prUrl, prBranch: prResult.branch }

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('[Auto-PR] Error:', msg)
        return { opened: false, reason: msg }
    }
}
