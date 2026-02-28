import { db } from '@/lib/db'
import { createPullRequest } from './repos'
import { getGitHubOctokit } from './auth'

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
        const octokit = getGitHubOctokit(accessToken)
        const { data } = await octokit.rest.repos.get({ owner, repo })
        return data.default_branch || 'main'
    } catch {
        return 'main'
    }
}

// ─── Construir el body del PR ──────────────────────────────────────────
function buildPRBody(params: {
    testName: string
    testFile: string | null
    failedSelector: string
    newSelector: string
    confidence: number
    reasoning: string | null
}): string {
    const confidencePct = Math.round(params.confidence * 100)
    return `## 🪄 Healify Auto-Fix

Healify detectó un selector roto y encontró una solución con **${confidencePct}% de confianza**.

### Test afectado
\`\`\`
${params.testName}${params.testFile ? `\nArchivo: ${params.testFile}` : ''}
\`\`\`

### Cambio del selector
| | Selector |
|---|---|
| ❌ **Roto** | \`${params.failedSelector}\` |
| ✅ **Nuevo** | \`${params.newSelector}\` |

### Razonamiento de la IA
${params.reasoning || 'El nuevo selector es más estable y resistente a cambios de UI.'}

---
*Generado automáticamente por [Healify](https://healify-sigma.vercel.app) · Confianza: ${confidencePct}%*
*Revisá el cambio antes de mergear.*`
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

        // 8. Construir el contenido del archivo modificado
        // Como no tenemos el archivo real, creamos un patch file de Healify
        const testFile = event.testFile || 'tests/healify-fixes.js'
        const patchContent = `// Healify Auto-Fix — ${new Date().toISOString()}
// Test: ${event.testName}
// Confianza: ${Math.round(event.confidence * 100)}%

// SELECTOR ROTO (reemplazar en tu test):
// ${event.failedSelector}

// SELECTOR NUEVO SUGERIDO POR HEALIFY:
// ${event.newSelector}

// Razonamiento: ${event.reasoning || 'Selector más estable detectado'}
`

        // 9. Abrir el PR
        const pr = await createPullRequest(
            accessToken,
            parsed.owner,
            parsed.repo,
            baseBranch,
            `healify-fixes/${healingEventId.slice(0, 8)}.md`,
            patchContent,
            `🪄 Healify: Auto-fix selector en ${event.testName}`,
            buildPRBody({
                testName: event.testName,
                testFile: event.testFile,
                failedSelector: event.failedSelector,
                newSelector: event.newSelector,
                confidence: event.confidence,
                reasoning: event.reasoning,
            })
        )

        // 10. Guardar prUrl en el HealingEvent
        await db.healingEvent.update({
            where: { id: healingEventId },
            data: {
                prUrl: pr.html_url,
                prBranch: pr.head.ref,
            }
        })

        if (project.userId) {
            await db.notification.create({
                data: {
                    userId: project.userId,
                    type: 'success',
                    title: 'PR automático creado',
                    message: `Healify abrió un PR para "${event.testName}" (${Math.round(event.confidence * 100)}% confianza).`,
                    link: pr.html_url,
                },
            }).catch(() => {})
        }

        console.log(`[Auto-PR] ✅ PR abierto: ${pr.html_url}`)
        return { opened: true, prUrl: pr.html_url, prBranch: pr.head.ref }

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('[Auto-PR] Error:', msg)
        return { opened: false, reason: msg }
    }
}
