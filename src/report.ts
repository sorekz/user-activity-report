import * as core from '@actions/core'
import { GithubApi } from './github'
import { AnalyzeOptions, ReportData } from './reportData'

export async function createReport(token: string, organization: string, since: Date, until: Date, analyzeOptions: AnalyzeOptions): Promise<ReportData> {
  const api = new GithubApi(token)
  const report = new ReportData(organization, analyzeOptions)
  const rateLimitStart = await api.getRateLimitRemaining()

  const sinceIsoString = since.toISOString()
  const untilIsoString = until.toISOString()

  core.debug('Reading org members')
  const orgMembers = await api.getOrgMembers(organization)
  for (const member of orgMembers) {
    report.setOrgMember(member)
  }

  core.debug('Getting org repositories')
  const repos = await api.getOrgRepos(organization)
  for (const repo of repos) {
    core.debug(`Analyzing repository: ${repo.name}...`)
    if (analyzeOptions.commits) {
      // commits
      core.debug('... commits')
      const branches = (analyzeOptions.commitsOnAllBranches ? await api.getRepoBranches(repo.id) : [await api.getRepoDefaultBranch(repo.id)].filter(b => !!b))
      const uniqueCommits = new Map<string, Awaited<ReturnType<typeof api.getBranchCommits>>[0]>() // <oid, commit>
      for (const branch of branches) {
        core.debug(`   ... on ${branch.name}`)
        const commits = await api.getBranchCommits(branch.id, sinceIsoString, untilIsoString)
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
        const issues = await api.getRepoIssues(repo.id, sinceIsoString)

        for (const issue of issues) {
          const createdAt = new Date(issue.createdAt)
          if (issue.author && createdAt >= since && createdAt < until) {
            report.addCreatedIssue(issue.author)
          }

          if (analyzeOptions.issueComments) {
            // issue comments
            core.debug(`   ... issue comments on #${issue.number}`)
            const issueComments = await api.getIssueComments(issue.id)
            for (const issueComment of issueComments) {
              const commentCreatedAt = new Date(issueComment.createdAt)
              if (issue.author && commentCreatedAt >= since && commentCreatedAt < until) {
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
        const createdAt = new Date(pr.createdAt)
        if (pr.author && createdAt >= since && createdAt < until) {
          report.addCreatedPr(pr.author)
        }
        if (pr.mergedAt && pr.mergedBy) {
          const mergedAt = new Date(pr.mergedAt)
          if (mergedAt >= since && mergedAt < until) {
            report.addMergedPr(pr.mergedBy)
          }
        }
         

        if (analyzeOptions.pullRequestComments) {
          // pr comments
          core.debug(`   ... pull request comments on #${pr.number}`)
          if (new Date(pr.updatedAt) >= since) {
            const comments = await api.getRepoPullComments(pr.id)
            for (const comment of comments) {
              const commentCreatedAt = new Date(comment.createdAt)
              if (comment.author && commentCreatedAt >= since && commentCreatedAt < until) {
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
          const createdAt = new Date(discussion.createdAt)
          if (discussion.author && createdAt >= since && createdAt < until) {
            report.addCreatedDiscussion(discussion.author)
          }

          if (analyzeOptions.discussionComments) {
            // discussions comments
            core.debug(`   ... discussion comments on #${discussion.number}`)
            if (new Date(discussion.updatedAt) >= since) {
              const comments = await api.getDiscussionComments(discussion.id)
              for (const comment of comments) {
                const commentCreatedAt = new Date(comment.createdAt)
                if (comment.author && commentCreatedAt >= since && commentCreatedAt < until) {
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
