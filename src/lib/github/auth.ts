import { Octokit } from 'octokit'

export function getGitHubOctokit(accessToken: string) {
    return new Octokit({
        auth: accessToken,
    })
}

export async function getGitHubUser(accessToken: string) {
    const octokit = getGitHubOctokit(accessToken)
    const { data } = await octokit.rest.users.getAuthenticated()
    return data
}
