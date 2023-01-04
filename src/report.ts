import * as core from '@actions/core'
import * as github from '@actions/github'
import { GithubApi } from './github'

export async function createReport(token: string, organization: string) {
  const api = new GithubApi(token)
  const rateLimitStart = await api.getRateLimit()

  const since = "2023-01-01T10:00:00Z"

  const repos = await api.getOrgRepos(organization)
  for (const repo of repos) {
    const branches = await api.getRepoBranches(repo.id)

    // commits
    const uniqueCommits = new Map<string, string>() // <oid, author>
    for (const branch of branches) {
      const commits = await api.getBranchCommits(branch.id, since)
      for (const commit of commits) {
        uniqueCommits.set(commit.oid, commit.author)
      }
    }

    // issues

    // issue comments

    // pr reviews

    // pr comments


  }

  const rateLimitEnd = await api.getRateLimit()
  core.info(`GraphQL rate limit cost: ${rateLimitEnd.remaining - rateLimitStart.remaining}`)
}



