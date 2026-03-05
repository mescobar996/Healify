import { getGitHubOctokit } from './auth'

// ═══════════════════════════════════════════════════════════════════════
// GitHub Check Runs — Create CI checks for Healify auto-fixes
//
// When Healify opens a PR with a selector fix, it also creates a
// "Healify / Selector Fix" check run on the PR's head commit.
//
// Status flow:
//   1. PR created → check run "queued"
//   2. Healing confidence evaluated → "completed" with pass/neutral
// ═══════════════════════════════════════════════════════════════════════

export interface CreateCheckRunParams {
  accessToken: string
  owner: string
  repo: string
  headSha: string
  healingEventId: string
  testName: string
  confidence: number
  oldSelector: string
  newSelector: string
  reasoning: string
}

/**
 * Creates a GitHub Check Run on the commit with healing analysis results.
 * Returns the check run URL or null if creation fails.
 */
export async function createHealifyCheckRun(params: CreateCheckRunParams): Promise<string | null> {
  try {
    const octokit = getGitHubOctokit(params.accessToken)
    const confidencePct = Math.round(params.confidence * 100)

    // Determine conclusion based on confidence
    const conclusion: 'success' | 'neutral' | 'failure' =
      params.confidence >= 0.95 ? 'success' :
      params.confidence >= 0.70 ? 'neutral' :
      'failure'

    const { data: checkRun } = await octokit.rest.checks.create({
      owner: params.owner,
      repo: params.repo,
      name: 'Healify / Selector Fix',
      head_sha: params.headSha,
      status: 'completed',
      conclusion,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      output: {
        title: `Selector curado: ${params.testName} (${confidencePct}%)`,
        summary: [
          `### 🪄 Healify Healing Analysis`,
          '',
          `**Test:** ${params.testName}`,
          `**Confianza:** ${confidencePct}%`,
          `**Conclusión:** ${conclusion === 'success' ? '✅ Auto-fix seguro' : conclusion === 'neutral' ? '🔍 Revisión sugerida' : '❌ Fix de baja confianza'}`,
          '',
          '| | Selector |',
          '|---|---|',
          `| ❌ Roto | \`${params.oldSelector}\` |`,
          `| ✅ Nuevo | \`${params.newSelector}\` |`,
          '',
          `### Razonamiento`,
          params.reasoning || 'El nuevo selector es más estable y resistente a cambios de UI.',
          '',
          `---`,
          `*Healing event: \`${params.healingEventId.slice(0, 8)}\`*`,
        ].join('\n'),
      },
    })

    return checkRun.html_url ?? null
  } catch (error) {
    console.error('[GitHub Checks] Failed to create check run:', error)
    return null
  }
}

/**
 * Reads a file from a GitHub repo at a specific ref.
 * Returns the file content and SHA (needed for updating the file).
 */
export async function getFileContent(
  accessToken: string,
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<{ content: string; sha: string } | null> {
  try {
    const octokit = getGitHubOctokit(accessToken)
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ...(ref ? { ref } : {}),
    })

    if (Array.isArray(data) || data.type !== 'file') return null

    const content = Buffer.from(data.content, 'base64').toString('utf-8')
    return { content, sha: data.sha }
  } catch {
    return null
  }
}

/**
 * Creates a PR with actual find-and-replace in the test file.
 * If the test file is found in the repo and contains the old selector,
 * it creates a proper code change instead of a patch file.
 */
export async function createSmartPR(params: {
  accessToken: string
  owner: string
  repo: string
  baseBranch: string
  testFile: string | null
  oldSelector: string
  newSelector: string
  testName: string
  confidence: number
  reasoning: string
  healingEventId: string
}): Promise<{ prUrl: string; headSha: string; branch: string } | null> {
  try {
    const octokit = getGitHubOctokit(params.accessToken)
    const headBranch = `healify-fix-${Date.now()}`

    // 1. Get base branch SHA
    const { data: refData } = await octokit.rest.git.getRef({
      owner: params.owner,
      repo: params.repo,
      ref: `heads/${params.baseBranch}`,
    })
    const baseSha = refData.object.sha

    // 2. Create new branch
    await octokit.rest.git.createRef({
      owner: params.owner,
      repo: params.repo,
      ref: `refs/heads/${headBranch}`,
      sha: baseSha,
    })

    // 3. Try to find and replace the selector in the actual test file
    let filePath: string
    let newContent: string

    if (params.testFile) {
      const file = await getFileContent(
        params.accessToken, params.owner, params.repo, params.testFile, headBranch
      )

      if (file && file.content.includes(params.oldSelector)) {
        // Real find-and-replace in the test file
        filePath = params.testFile
        newContent = file.content.replace(params.oldSelector, params.newSelector)
      } else {
        // Fallback: create a Healify patch file
        filePath = `healify-fixes/${params.healingEventId.slice(0, 8)}.md`
        newContent = buildPatchFile(params)
      }
    } else {
      filePath = `healify-fixes/${params.healingEventId.slice(0, 8)}.md`
      newContent = buildPatchFile(params)
    }

    // 4. Get existing file SHA if updating
    let fileSha: string | undefined
    try {
      const { data: fileData } = await octokit.rest.repos.getContent({
        owner: params.owner,
        repo: params.repo,
        path: filePath,
        ref: headBranch,
      })
      if (!Array.isArray(fileData)) fileSha = fileData.sha
    } catch { /* file doesn't exist yet */ }

    // 5. Commit the change
    const commitResult = await octokit.rest.repos.createOrUpdateFileContents({
      owner: params.owner,
      repo: params.repo,
      path: filePath,
      message: `🪄 Healify: fix selector in ${params.testName}`,
      content: Buffer.from(newContent).toString('base64'),
      branch: headBranch,
      sha: fileSha,
    })

    const headSha = commitResult.data.commit.sha ?? baseSha

    // 6. Build PR body
    const confidencePct = Math.round(params.confidence * 100)
    const prBody = `## 🪄 Healify Auto-Fix

Healify detectó un selector roto y encontró una solución con **${confidencePct}% de confianza**.

### Test afectado
\`\`\`
${params.testName}${params.testFile ? `\nArchivo: ${params.testFile}` : ''}
\`\`\`

### Cambio del selector
| | Selector |
|---|---|
| ❌ **Roto** | \`${params.oldSelector}\` |
| ✅ **Nuevo** | \`${params.newSelector}\` |

### Razonamiento de la IA
${params.reasoning || 'El nuevo selector es más estable y resistente a cambios de UI.'}

---
*Generado automáticamente por [Healify](https://healify-sigma.vercel.app) · Confianza: ${confidencePct}%*
*Revisá el cambio antes de mergear.*`

    // 7. Open PR
    const { data: pr } = await octokit.rest.pulls.create({
      owner: params.owner,
      repo: params.repo,
      title: `🪄 Healify: fix selector in ${params.testName}`,
      body: prBody,
      head: headBranch,
      base: params.baseBranch,
    })

    return { prUrl: pr.html_url, headSha, branch: headBranch }
  } catch (error) {
    console.error('[Smart PR] Error:', error)
    return null
  }
}

function buildPatchFile(params: {
  testName: string
  testFile: string | null
  oldSelector: string
  newSelector: string
  confidence: number
  reasoning: string
}): string {
  return `# Healify Auto-Fix — ${new Date().toISOString()}

## Test: ${params.testName}
${params.testFile ? `## Archivo: ${params.testFile}` : ''}
## Confianza: ${Math.round(params.confidence * 100)}%

### Selector roto (reemplazar en tu test):
\`\`\`
${params.oldSelector}
\`\`\`

### Selector nuevo sugerido por Healify:
\`\`\`
${params.newSelector}
\`\`\`

### Razonamiento: 
${params.reasoning || 'Selector más estable detectado'}
`
}
