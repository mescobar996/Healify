import { Worker, Job } from 'bullmq'
import { redis } from '../lib/redis'
import { TEST_QUEUE_NAME } from '../lib/queue'
import { analyzeBrokenSelector } from '../lib/ai/healing-service'
import { saveSnapshot } from '../lib/storage'
import { db } from '../lib/db'
import { createPullRequest } from '../lib/github/repos'

console.log('--- Healify Test Worker Starting ---')

const worker = new Worker(
    TEST_QUEUE_NAME,
    async (job: Job) => {
        const { projectId, commitSha } = job.data
        console.log(`[Job ${job.id}] Processing tests for project: ${projectId}`)

        // 1. Simular ejecución de Playwright (Placeholder para Sprint 1)
        console.log(`[Job ${job.id}] Running Playwright tests...`)
        await new Promise(r => setTimeout(r, 3000))

        // 2. Simular un fallo que necesita autocuración
        const failedSelector = '.old-button-selector'
        const errorMsg = 'Error: element not found'
        const mockDom = '<html><body><button data-testid="login-btn">Login</button></body></html>'

        // 3. Guardar snapshot en Storage
        console.log(`[Job ${job.id}] Saving DOM snapshot...`)
        const snapshotName = `failure-${job.id}-${Date.now()}.html`
        const snapshotUrl = await saveSnapshot(snapshotName, mockDom)
        console.log(`[Job ${job.id}] Snapshot saved at: ${snapshotUrl}`)

        console.log(`[Job ${job.id}] Test failed. Attempting auto-healing...`)
        const suggestion = await analyzeBrokenSelector(failedSelector, errorMsg, mockDom)

        if (suggestion && suggestion.confidence > 0.8) {
            console.log(`[Job ${job.id}] SUCCESS: Selector healed to -> ${suggestion.newSelector}`)

            // 4. Intentar crear PR si tenemos token
            const project = await db.project.findUnique({
                where: { id: projectId },
                include: { user: { include: { accounts: { where: { provider: 'github' } } } } }
            })

            if (!project) {
                console.error(`[Job ${job.id}] Project ${projectId} not found.`)
                return { success: false, error: 'Project not found' }
            }

            const githubAccount = project.user?.accounts?.[0]
            if (githubAccount?.access_token) {
                console.log(`[Job ${job.id}] Creating Pull Request on GitHub...`)
                try {
                    const repoUrl = project.repository || ''
                    const parts = repoUrl.replace('https://github.com/', '').split('/')
                    const owner = parts[0]
                    const repo = parts[1]

                    const flowTestName = job.data.testName || 'Unknown Test'

                    await createPullRequest(
                        githubAccount.access_token,
                        owner,
                        repo,
                        'main',
                        failedSelector,
                        `// Healed by Healify\nconst selector = '${suggestion.newSelector}';`,
                        `🪄 Healify: Fix broken selector in ${flowTestName}`,
                        `Healify identified a broken selector and automatically fixed it.\n\n**Original:** \`${failedSelector}\`\n**New:** \`${suggestion.newSelector}\`\n**Confidence:** ${(suggestion.confidence * 100).toFixed(1)}%\n\n**Reasoning:** ${suggestion.reasoning}`
                    )
                    console.log(`[Job ${job.id}] PR created successfully!`)
                } catch (prError: any) {
                    console.error(`[Job ${job.id}] Failed to create PR:`, prError.message)
                }
            } else {
                console.log(`[Job ${job.id}] No GitHub access token found for user. Skipping PR.`)
            }
        }

        return { success: true, healed: !!suggestion }
    },
    { connection: redis as any }
)

worker.on('completed', job => {
    console.log(`[Job ${job.id}] COMPLETED`)
})

worker.on('failed', (job, err) => {
    console.log(`[Job ${job?.id}] FAILED: ${err.message}`)
})
