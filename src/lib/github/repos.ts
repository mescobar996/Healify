import { getGitHubOctokit } from './auth'

export interface GitHubRepo {
    id: number
    name: string
    full_name: string
    description: string | null
    html_url: string
    stargazers_count: number
    language: string | null
}

export async function listUserRepos(accessToken: string): Promise<GitHubRepo[]> {
    const octokit = getGitHubOctokit(accessToken)
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: 50,
    })

    return data.map(repo => ({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        html_url: repo.html_url,
        stargazers_count: repo.stargazers_count,
        language: repo.language,
    }))
}

export async function setupWebhook(accessToken: string, owner: string, repo: string) {
    const octokit = getGitHubOctokit(accessToken)

    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook/github`

    try {
        const { data } = await octokit.rest.repos.createWebhook({
            owner,
            repo,
            config: {
                url: webhookUrl,
                content_type: 'json',
                secret: process.env.GITHUB_WEBHOOK_SECRET,
            },
            events: ['push', 'pull_request'],
        })
        return data
    } catch (error: any) {
        if (error.status === 422) {
            // Hook already exists
            return { message: 'Webhook already exists' }
        }
        throw error
    }
}

export async function createPullRequest(
    accessToken: string,
    owner: string,
    repo: string,
    baseBranch: string,
    filePath: string,
    content: string,
    title: string,
    body: string
) {
    const octokit = getGitHubOctokit(accessToken)
    const headBranch = `healify-fix-${Date.now()}`

    // 1. Obtener el SHA de la rama base
    const { data: refData } = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${baseBranch}`,
    })
    const baseSha = refData.object.sha

    // 2. Crear nueva rama
    await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${headBranch}`,
        sha: baseSha,
    })

    // 3. Obtener el SHA del archivo (si existe) para actualizarlo
    let fileSha: string | undefined
    try {
        const { data: fileData } = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: filePath,
            ref: headBranch,
        })
        if (!Array.isArray(fileData)) {
            fileSha = fileData.sha
        }
    } catch (e) {
        // File doesn't exist yet, that's fine
    }

    // 4. Hacer el commit
    await octokit.rest.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: filePath,
        message: '🪄 Healify: Auto-fix test selector',
        content: Buffer.from(content).toString('base64'),
        branch: headBranch,
        sha: fileSha,
    })

    // 5. Crear el PR
    const { data: pr } = await octokit.rest.pulls.create({
        owner,
        repo,
        title,
        body,
        head: headBranch,
        base: baseBranch,
    })

    return pr
}
