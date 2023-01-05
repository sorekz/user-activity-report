import * as core from '@actions/core'
import { GithubApi } from './github'
import { AnalyzeOptions, ReportData } from './reportData'

export async function createReport(token: string, organization: string, sinceDays: number, analyzeOptions: AnalyzeOptions): Promise<ReportData> {
  const api = new GithubApi(token)
  const report = new ReportData(organization, analyzeOptions)
  const rateLimitStart = await api.getRateLimitRemaining()

  const date = new Date()
  const since = new Date(date.setDate(date.getDate() - sinceDays)).toISOString()

  const orgMembers = await api.getOrgMembers(organization)
  for (const member of orgMembers) {
    report.setOrgMember(member)
  }

  const repos = await api.getOrgRepos(organization)
  for (const repo of repos) {
    if (analyzeOptions.commits) {
      // commits
      const branches = analyzeOptions.commitsOnAllBranches ? await api.getRepoBranches(repo.id) : [await api.getRepoDefaultBranch(repo.id)]
      const uniqueCommits = new Map<string, Awaited<ReturnType<typeof api.getBranchCommits>>[0]>() // <oid, commit>
      for (const branch of branches) {
        const commits = await api.getBranchCommits(branch.id, since)
        for (const commit of commits) {
          uniqueCommits.set(commit.oid, commit)
        }
      }
      for (const commit of uniqueCommits.values()) {
        report.addCommit(commit.author)
      }
    }

    if (analyzeOptions.issues) {
      // issues
      if (repo.hasIssuesEnabled) {
        const issues = await api.getRepoIssues(repo.id, since)

        for (const issue of issues) {
          if (new Date(issue.createdAt) > new Date(since)) {
            report.addCreatedIssue(issue.author)
          }

          if (analyzeOptions.issueComments) {
            // issue comments
            const issueComments = await api.getIssueComments(issue.id)
            for (const issueComment of issueComments) {
              if (new Date(issueComment.createdAt) > new Date(since)) {
                report.addIssueComment(issue.author)
              }
            }
          }
        }
      }
    }

    if (analyzeOptions.pullRequests) {
      // prs
      const prs = await api.getRepoPullRequests(repo.id)
      for (const pr of prs) {
        if (new Date(pr.createdAt) > new Date(since)) {
          report.addCreatedPr(pr.author)
        }
        if (pr.mergedAt && pr.mergedBy && new Date(pr.mergedAt) > new Date(since)) {
          report.addMergedPr(pr.mergedBy)
        }

        if (analyzeOptions.pullRequestComments) {
          // pr comments
          if (new Date(pr.updatedAt) > new Date(since)) {
            const comments = await api.getRepoPullComments(pr.id)
            for (const comment of comments) {
              if (new Date(comment.createdAt) > new Date(since)) {
                report.addPrComment(comment.author)
              }
            }
          }
        }
      }
    }


    if (analyzeOptions.discussions) {
      // discussions
      if (repo.hasDiscussionsEnabled) {
        const discussions = await api.getRepoDiscussions(repo.id)
        for (const discussion of discussions) {
          if (new Date(discussion.createdAt) > new Date(since)) {
            report.addCreatedDiscussion(discussion.author)
          }

          if (analyzeOptions.discussionComments) {
            // discussions comments
            if (new Date(discussion.updatedAt) > new Date(since)) {
              const comments = await api.getDiscussionComments(discussion.id)
              for (const comment of comments) {
                if (new Date(comment.createdAt) > new Date(since)) {
                  report.addDiscussionComment(comment.author)
                }
              }
            }
          }
        }
      }
    }
  }

  const rateLimitEnd = await api.getRateLimitRemaining()
  core.info(`GraphQL rate limit cost: ${rateLimitStart - rateLimitEnd}`)

  return report
}
