import * as core from '@actions/core'
import { GithubApi } from './github'
import { AnalyzeOptions, ReportData } from './reportData'

export async function createReport(token: string, organization: string, sinceDays: number, analyzeOptions: AnalyzeOptions): Promise<ReportData> {
  const api = new GithubApi(token)
  const report = new ReportData(organization, analyzeOptions)
  const rateLimitStart = await api.getRateLimitRemaining()

  const date = new Date()
  const since = new Date(date.setDate(date.getDate() - sinceDays)).toISOString()

  core.debug('Reading org members')
  const orgMembers = await api.getOrgMembers(organization)
  for (const member of orgMembers) {
    report.setOrgMember(member)
  }

  core.debug('Getting org repositories')
  const repos = await api.getOrgRepos(organization)
  for (const repo of repos) {
    core.debug(`For ${repo.name} analyzing ...`)
    if (analyzeOptions.commits) {
      // commits
      core.debug('... commits')
      const branches = (analyzeOptions.commitsOnAllBranches ? await api.getRepoBranches(repo.id) : [await api.getRepoDefaultBranch(repo.id)].filter(b => !!b))
      const uniqueCommits = new Map<string, Awaited<ReturnType<typeof api.getBranchCommits>>[0]>() // <oid, commit>
      for (const branch of branches) {
        core.debug(`   ... on ${branch.name}`)
        const commits = await api.getBranchCommits(branch.id, since)
        for (const commit of commits) {
          uniqueCommits.set(commit.oid, commit)
        }
      }
      for (const commit of uniqueCommits.values()) {
        if (commit.author) { // imported commits might not have a Github user reference and are ignored in the report
          report.addCommit(commit.author)
        }
      }
    }

    if (analyzeOptions.issues) {
      // issues
      if (repo.hasIssuesEnabled) {
        core.debug('... issues')
        const issues = await api.getRepoIssues(repo.id, since)

        for (const issue of issues) {
          if (issue.author && new Date(issue.createdAt) > new Date(since)) {
            report.addCreatedIssue(issue.author)
          }

          if (analyzeOptions.issueComments) {
            // issue comments
            core.debug(`   ... issue comments on #${issue.number}`)
            const issueComments = await api.getIssueComments(issue.id)
            for (const issueComment of issueComments) {
              if (issue.author && new Date(issueComment.createdAt) > new Date(since)) {
                report.addIssueComment(issue.author)
              }
            }
          }
        }
      }
    }

    if (analyzeOptions.pullRequests) {
      // prs
      core.debug('... pull requests')
      const prs = await api.getRepoPullRequests(repo.id)
      for (const pr of prs) {
        if (pr.author && new Date(pr.createdAt) > new Date(since)) {
          report.addCreatedPr(pr.author)
        }
        if (pr.mergedAt && pr.mergedBy && new Date(pr.mergedAt) > new Date(since)) {
          report.addMergedPr(pr.mergedBy)
        }

        if (analyzeOptions.pullRequestComments) {
          // pr comments
          core.debug(`   ... pull request comments on #${pr.number}`)
          if (new Date(pr.updatedAt) > new Date(since)) {
            const comments = await api.getRepoPullComments(pr.id)
            for (const comment of comments) {
              if (comment.author && new Date(comment.createdAt) > new Date(since)) {
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
        core.debug('... pull requests')
        const discussions = await api.getRepoDiscussions(repo.id)
        for (const discussion of discussions) {
          if (discussion.author && new Date(discussion.createdAt) > new Date(since)) {
            report.addCreatedDiscussion(discussion.author)
          }

          if (analyzeOptions.discussionComments) {
            // discussions comments
            core.debug(`   ... discussion comments on #${discussion.number}`)
            if (new Date(discussion.updatedAt) > new Date(since)) {
              const comments = await api.getDiscussionComments(discussion.id)
              for (const comment of comments) {
                if (comment.author && new Date(comment.createdAt) > new Date(since)) {
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
