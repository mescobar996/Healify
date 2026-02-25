/**
 * HEALIFY RAILWAY WORKER
 * 
 * Este worker se ejecuta en Railway (no en Vercel serverless) y tiene la capacidad de:
 * 1. Clonar repositorios de GitHub
 * 2. Instalar dependencias con npm/bun
 * 3. Ejecutar Playwright contra los tests reales del repo
 * 4. Analizar fallos con el healing service
 * 5. Crear Auto-PRs cuando confidence >= 0.95
 * 
 * Requiere las siguientes variables de entorno:
 * - DATABASE_URL: PostgreSQL connection string
 * - REDIS_URL: Redis connection for BullMQ
 * - (IA via ZAI SDK — no se necesita env var adicional, viene integrado)
 * - GITHUB_WEBHOOK_SECRET: Para clonar repos privados si es necesario
 */

import { createServer } from 'http'
import { Worker, Job } from 'bullmq'
import { execSync, exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { db } from '../lib/db'
import { TestStatus, HealingStatus, SelectorType } from '../lib/enums'
import { TEST_QUEUE_NAME, TestJobData } from '../lib/queue'
import { analyzeBrokenSelector } from '../lib/ai/healing-service'
import { createPullRequest } from '../lib/github/repos'

const execAsync = promisify(exec)

// ============================================
// TIPOS Y INTERFACES
// ============================================

interface TestFailure {
    testName: string
    testFile: string
    failedSelector: string
    errorMessage: string
    stackTrace?: string
    domSnapshot?: string
}

interface TestResult {
    passed: number
    failed: number
    failures: TestFailure[]
    duration: number
    rawOutput: string
}

// ============================================
// UTILIDADES
// ============================================

function log(jobId: string, message: string): void {
    console.log(`[Job ${jobId}] ${message}`)
}

function logError(jobId: string, message: string, error?: Error | unknown): void {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[Job ${jobId}] ERROR: ${message}`, errorMsg)
}

// ============================================
// GESTIÓN DE REPOSITORIOS
// ============================================

/**
 * Clona el repositorio del usuario en un directorio temporal
 */
async function cloneRepository(
    jobId: string,
    repositoryUrl: string,
    branch: string = 'main',
    commitSha?: string
): Promise<string> {
    const workDir = path.join(os.tmpdir(), `healify-${jobId}-${Date.now()}`)
    
    log(jobId, `Creating work directory: ${workDir}`)
    await fs.mkdir(workDir, { recursive: true })
    
    const cloneUrl = repositoryUrl
    
    log(jobId, `Cloning repository: ${repositoryUrl} (branch: ${branch})`)
    
    try {
        execSync(`git clone --depth 1 --branch ${branch} ${cloneUrl} .`, {
            cwd: workDir,
            stdio: 'pipe',
            timeout: 60000
        })
        
        if (commitSha) {
            log(jobId, `Checking out commit: ${commitSha}`)
            try {
                execSync(`git fetch --depth 1 origin ${commitSha} && git checkout ${commitSha}`, {
                    cwd: workDir,
                    stdio: 'pipe'
                })
            } catch {
                log(jobId, `Could not checkout specific commit, using HEAD of ${branch}`)
            }
        }
        
        return workDir
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        logError(jobId, `Failed to clone repository: ${err.message}`)
        throw new Error(`Failed to clone repository: ${err.message}`)
    }
}

/**
 * Detecta el gestor de paquetes y framework de testing
 */
async function detectTestFramework(workDir: string): Promise<{
    packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun'
    testCommand: string
    hasPlaywright: boolean
}> {
    const files = await fs.readdir(workDir)
    
    let packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' = 'npm'
    if (files.includes('bun.lockb')) packageManager = 'bun'
    else if (files.includes('pnpm-lock.yaml')) packageManager = 'pnpm'
    else if (files.includes('yarn.lock')) packageManager = 'yarn'
    
    let hasPlaywright = false
    let testCommand = 'test'
    
    try {
        const pkgJson = JSON.parse(await fs.readFile(path.join(workDir, 'package.json'), 'utf-8'))
        const scripts = pkgJson.scripts || {}
        
        if (scripts['test:e2e']) testCommand = 'test:e2e'
        else if (scripts['test:playwright']) testCommand = 'test:playwright'
        else if (scripts['test']) testCommand = 'test'
        
        const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies }
        hasPlaywright = !!(deps['@playwright/test'] || deps['playwright'])
        
    } catch {
        // No hay package.json o es inválido
    }
    
    return { packageManager, testCommand, hasPlaywright }
}

/**
 * Instala dependencias del proyecto
 */
async function installDependencies(
    jobId: string,
    workDir: string,
    packageManager: string
): Promise<void> {
    log(jobId, `Installing dependencies with ${packageManager}...`)
    
    const installCmds: Record<string, string> = {
        npm: 'npm ci --prefer-offline',
        yarn: 'yarn install --frozen-lockfile',
        pnpm: 'pnpm install --frozen-lockfile',
        bun: 'bun install --frozen-lockfile'
    }
    
    const installCmd = installCmds[packageManager] || 'npm install'
    
    try {
        execSync(installCmd, {
            cwd: workDir,
            stdio: 'pipe',
            timeout: 300000
        })
        log(jobId, 'Dependencies installed successfully')
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        logError(jobId, `Failed to install dependencies: ${err.message}`)
        throw new Error(`Failed to install dependencies: ${err.message}`)
    }
}

/**
 * Instala navegadores de Playwright si es necesario
 */
async function installPlaywrightBrowsers(jobId: string, workDir: string): Promise<void> {
    log(jobId, 'Ensuring Playwright browsers are installed...')
    
    try {
        execSync('npx playwright install chromium --with-deps', {
            cwd: workDir,
            stdio: 'pipe',
            timeout: 180000
        })
        log(jobId, 'Playwright browsers ready')
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        log(jobId, `Playwright browser install warning: ${err.message}`)
    }
}

// ============================================
// EJECUCIÓN DE TESTS
// ============================================

/**
 * Ejecuta los tests de Playwright del repositorio
 */
async function runPlaywrightTests(
    jobId: string,
    workDir: string,
    packageManager: string,
    testCommand: string
): Promise<TestResult> {
    log(jobId, `Running Playwright tests: ${testCommand}`)
    
    const runCmd = `${packageManager} run ${testCommand} --reporter=json || true`
    
    const result: TestResult = {
        passed: 0,
        failed: 0,
        failures: [],
        duration: 0,
        rawOutput: ''
    }
    
    try {
        const { stdout, stderr } = await execAsync(runCmd, {
            cwd: workDir,
            timeout: 600000,
            maxBuffer: 10 * 1024 * 1024
        })
        result.rawOutput = stdout + stderr
        
        // Intentar parsear el output de Playwright JSON
        try {
            const reportPath = path.join(workDir, 'test-results', 'report.json')
            const reportData = JSON.parse(await fs.readFile(reportPath, 'utf-8'))
            
            for (const suite of reportData.suites || []) {
                for (const spec of suite.specs || []) {
                    for (const test of spec.tests || []) {
                        if (test.status === 'passed') {
                            result.passed++
                        } else if (test.status === 'failed') {
                            result.failed++
                            result.failures.push({
                                testName: spec.title,
                                testFile: suite.file || 'unknown',
                                failedSelector: extractSelectorFromError(test.error?.message || ''),
                                errorMessage: test.error?.message || 'Unknown error',
                                stackTrace: test.error?.stack
                            })
                        }
                    }
                }
            }
        } catch {
            // Si no hay reporte JSON, parsear el output de texto
            log(jobId, 'No JSON report found, parsing text output')
            
            const passedMatch = result.rawOutput.match(/(\d+) passed/)
            const failedMatch = result.rawOutput.match(/(\d+) failed/)
            
            if (passedMatch) result.passed = parseInt(passedMatch[1], 10)
            if (failedMatch) result.failed = parseInt(failedMatch[1], 10)
            
            // Extraer errores básicos del output (sin usar flag 's' para compatibilidad ES5)
            // Usamos [\s\S] en lugar de . con flag s
            const errorRegex = /Error:([\s\S]*?)(?=\n\n|\n  at|$)/g
            let match
            while ((match = errorRegex.exec(result.rawOutput)) !== null) {
                result.failures.push({
                    testName: 'Unknown test',
                    testFile: 'Unknown file',
                    failedSelector: extractSelectorFromError(match[1]),
                    errorMessage: match[1].trim()
                })
            }
        }
        
        result.duration = Date.now()
        
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        logError(jobId, `Test execution error: ${err.message}`)
        
        const execErr = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string }
        result.rawOutput = execErr.stdout || '' + execErr.stderr || ''
        
        result.failed = 1
        result.failures.push({
            testName: 'Test execution failed',
            testFile: 'System',
            failedSelector: '',
            errorMessage: err.message
        })
    }
    
    log(jobId, `Tests completed: ${result.passed} passed, ${result.failed} failed`)
    return result
}

/**
 * Extrae el selector fallido de un mensaje de error de Playwright
 */
function extractSelectorFromError(errorMessage: string): string {
    const patterns = [
        /Waiting for selector ["']([^"']+)["']/,
        /Element not found: (\S+)/,
        /Unable to locate element: (\S+)/,
        /selector ["']([^"']+)["'] not found/,
        / locator\(["']([^"']+)["']\)/,
    ]
    
    for (const pattern of patterns) {
        const match = errorMessage.match(pattern)
        if (match) return match[1]
    }
    
    return 'Unknown selector'
}

// ============================================
// HEALING Y AUTO-PR
// ============================================

/**
 * Analiza un fallo y genera sugerencia de healing
 */
async function healTestFailure(
    jobId: string,
    failure: TestFailure,
    _workDir: string
): Promise<{
    healed: boolean
    suggestion?: {
        newSelector: string
        confidence: number
        reasoning: string
    }
}> {
    log(jobId, `Analyzing failure: ${failure.testName}`)
    
    const domSnapshot = failure.domSnapshot || '<html><body>DOM not captured</body></html>'
    
    const suggestion = await analyzeBrokenSelector(
        failure.failedSelector,
        failure.errorMessage,
        domSnapshot
    )
    
    if (!suggestion) {
        return { healed: false }
    }
    
    log(jobId, `Healing suggestion: ${suggestion.newSelector} (confidence: ${suggestion.confidence})`)
    
    return {
        healed: suggestion.confidence >= 0.95,
        suggestion: {
            newSelector: suggestion.newSelector,
            confidence: suggestion.confidence,
            reasoning: suggestion.reasoning
        }
    }
}

/**
 * Crea un Pull Request con el fix del selector
 */
async function createHealingPR(
    jobId: string,
    project: { id: string; repository: string | null },
    failure: TestFailure,
    suggestion: { newSelector: string; confidence: number; reasoning: string }
): Promise<string | null> {
    const projectWithUser = await db.project.findUnique({
        where: { id: project.id },
        include: { 
            user: { 
                include: { 
                    accounts: { where: { provider: 'github' } } 
                } 
            } 
        }
    })
    
    const githubAccount = projectWithUser?.user?.accounts?.[0]
    if (!githubAccount?.access_token) {
        log(jobId, 'No GitHub access token found for user, cannot create PR')
        return null
    }
    
    const repoUrl = project.repository || ''
    const parts = repoUrl.replace('https://github.com/', '').split('/')
    const owner = parts[0]
    const repo = parts[1]
    
    if (!owner || !repo) {
        log(jobId, 'Invalid repository URL format')
        return null
    }
    
    try {
        log(jobId, `Creating PR on ${owner}/${repo}...`)
        
        const pr = await createPullRequest(
            githubAccount.access_token,
            owner,
            repo,
            'main',
            failure.testFile,
            `// Healed by Healify\nconst selector = '${suggestion.newSelector}';`,
            `🪄 Healify: Fix broken selector in ${failure.testName}`,
            `Healify identified a broken selector and automatically fixed it.\n\n**Original:** \`${failure.failedSelector}\`\n**New:** \`${suggestion.newSelector}\`\n**Confidence:** ${(suggestion.confidence * 100).toFixed(1)}%\n\n**Reasoning:** ${suggestion.reasoning}\n\n**Error was:** ${failure.errorMessage}`
        )
        
        log(jobId, `PR created: ${pr.html_url}`)
        return pr.html_url
        
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        logError(jobId, `Failed to create PR: ${err.message}`)
        return null
    }
}

// ============================================
// CLEANUP
// ============================================

async function cleanupWorkDir(workDir: string): Promise<void> {
    try {
        await fs.rm(workDir, { recursive: true, force: true })
    } catch (error) {
        console.warn(`Failed to cleanup ${workDir}:`, error)
    }
}

// ============================================
// WORKER PRINCIPAL
// ============================================

interface ProcessJobResult {
    success: boolean
    passed: number
    failed: number
    healed: number
    error?: string
}

async function processJob(job: Job<TestJobData>): Promise<ProcessJobResult> {
    const { projectId, commitSha, testRunId, branch, repository } = job.data
    const jobId = job.id || 'unknown'
    
    log(jobId, `Processing tests for project: ${projectId}`)
    log(jobId, `TestRun: ${testRunId}, Branch: ${branch}, Commit: ${commitSha}`)
    
    let workDir: string | null = null
    
    try {
        await db.testRun.update({
            where: { id: testRunId },
            data: { 
                status: TestStatus.RUNNING,
                startedAt: new Date()
            }
        })
        
        const project = await db.project.findUnique({
            where: { id: projectId }
        })
        
        if (!project) {
            throw new Error(`Project ${projectId} not found`)
        }
        
        workDir = await cloneRepository(
            jobId, 
            repository || project.repository || '',
            branch,
            commitSha
        )
        
        const framework = await detectTestFramework(workDir)
        
        if (!framework.hasPlaywright) {
            throw new Error('Repository does not have Playwright installed')
        }
        
        await installDependencies(jobId, workDir, framework.packageManager)
        await installPlaywrightBrowsers(jobId, workDir)
        
        job.updateProgress(30)
        const testStartTime = Date.now()
        
        const testResults = await runPlaywrightTests(
            jobId,
            workDir,
            framework.packageManager,
            framework.testCommand
        )
        
        const testDuration = Date.now() - testStartTime
        job.updateProgress(60)
        
        let healedCount = 0
        
        for (const failure of testResults.failures) {
            const healing = await healTestFailure(jobId, failure, workDir)
            
            const healingEvent = await db.healingEvent.create({
                data: {
                    testRunId,
                    testName: failure.testName,
                    testFile: failure.testFile,
                    failedSelector: failure.failedSelector,
                    selectorType: SelectorType.UNKNOWN,
                    errorMessage: failure.errorMessage,
                    stackTrace: failure.stackTrace,
                    newSelector: healing.suggestion?.newSelector,
                    confidence: healing.suggestion?.confidence,
                    reasoning: healing.suggestion?.reasoning,
                    status: healing.healed ? HealingStatus.HEALED_AUTO : HealingStatus.NEEDS_REVIEW
                }
            })
            
            if (healing.healed && healing.suggestion) {
                const prUrl = await createHealingPR(jobId, project, failure, healing.suggestion)
                
                if (prUrl) {
                    await db.healingEvent.update({
                        where: { id: healingEvent.id },
                        data: { 
                            prUrl,
                            prBranch: `healify-fix-${Date.now()}`,
                            actionTaken: 'auto_fixed',
                            appliedAt: new Date(),
                            appliedBy: 'system'
                        }
                    })
                    healedCount++
                }
            }
        }
        
        job.updateProgress(90)
        
        const finalStatus = testResults.failed === 0 
            ? TestStatus.PASSED 
            : healedCount === testResults.failed 
                ? TestStatus.HEALED 
                : TestStatus.PARTIAL
        
        await db.testRun.update({
            where: { id: testRunId },
            data: {
                status: finalStatus,
                totalTests: testResults.passed + testResults.failed,
                passedTests: testResults.passed,
                failedTests: testResults.failed,
                healedTests: healedCount,
                duration: testDuration,
                finishedAt: new Date()
            }
        })
        
        log(jobId, `Test run completed: ${finalStatus}`)
        log(jobId, `Results: ${testResults.passed} passed, ${testResults.failed} failed, ${healedCount} healed`)
        
        return {
            success: true,
            passed: testResults.passed,
            failed: testResults.failed,
            healed: healedCount
        }
        
    } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        logError(jobId, `Job failed: ${err.message}`)
        
        await db.testRun.update({
            where: { id: testRunId },
            data: {
                status: TestStatus.FAILED,
                error: err.message,
                finishedAt: new Date()
            }
        })
        
        return {
            success: false,
            passed: 0,
            failed: 0,
            healed: 0,
            error: err.message
        }
        
    } finally {
        if (workDir) {
            await cleanupWorkDir(workDir)
        }
    }
}

// ============================================
// INICIALIZACIÓN DEL WORKER
// ============================================

console.log('========================================')
console.log('🚀 HEALIFY RAILWAY WORKER STARTING')
console.log('========================================')

const redisUrl = process.env.REDIS_URL

if (!redisUrl) {
    console.error('❌ FATAL: REDIS_URL not set')
    console.error('Make sure REDIS_URL is set in environment variables')
    process.exit(1)
}

console.log('✅ Redis URL configured')
console.log(`📦 Queue: ${TEST_QUEUE_NAME}`)
console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`)

const worker = new Worker<TestJobData>(
    TEST_QUEUE_NAME,
    async (job: Job<TestJobData>) => {
        console.log(`\n${'='.repeat(50)}`)
        console.log(`📥 Job received: ${job.id}`)
        console.log('='.repeat(50))
        
        const result = await processJob(job)
        
        console.log('='.repeat(50))
        console.log(`📤 Job completed: ${job.id}`)
        console.log(`   Success: ${result.success}`)
        console.log(`   Results: ${result.passed} passed, ${result.failed} failed, ${result.healed} healed`)
        console.log('='.repeat(50), '\n')
        
        return result
    },
    {
        connection: {
            url: redisUrl
        },
        concurrency: 2,
        limiter: {
            max: 10,
            duration: 60000
        }
    }
)

worker.on('completed', (job: Job<TestJobData>) => {
    console.log(`✅ Job ${job.id} completed successfully`)
})

worker.on('failed', (job: Job<TestJobData> | undefined, error: Error) => {
    console.error(`❌ Job ${job?.id} failed:`, error.message)
})

worker.on('error', (error: Error) => {
    console.error('Worker error:', error)
})

worker.on('stalled', (jobId: string) => {
    console.warn(`⚠️ Job ${jobId} stalled`)
})

// ── Health check HTTP server ─────────────────────────────────────────
// Railway hace healthcheck en /health — sin este servidor el deploy
// queda UNHEALTHY aunque el worker esté procesando jobs correctamente.
// PORT es inyectado por Railway automáticamente (default 8080).
const PORT = parseInt(process.env.PORT || '8080', 10)

const healthServer = createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
            status: 'ok',
            worker: 'healify-railway-worker',
            queue: TEST_QUEUE_NAME,
            uptime: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
        }))
    } else {
        res.writeHead(404)
        res.end('Not found')
    }
})

healthServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🏥 Health server listening on 0.0.0.0:${PORT} -> GET /health`)
})

console.log('\n🎯 Worker ready and listening for jobs...\n')

process.on('SIGTERM', async () => {
    console.log('\n🛑 SIGTERM received, shutting down gracefully...')
    healthServer.close()
    await worker.close()
    process.exit(0)
})

process.on('SIGINT', async () => {
    console.log('\n🛑 SIGINT received, shutting down gracefully...')
    healthServer.close()
    await worker.close()
    process.exit(0)
})
