import * as core from '@actions/core'
import * as fs from 'fs'
import { createReport } from './report'
import { AnalyzeOptions } from './reportData'

async function run(): Promise<void> {
  try {
    const options: AnalyzeOptions = {
      commits: core.getBooleanInput('analyze-commits'),
      commitsOnAllBranches: core.getBooleanInput('analyze-commits-on-all-branches'),
      issues: core.getBooleanInput('analyze-issues'),
      issueComments: core.getBooleanInput('analyze-issue-comments'),
      pullRequests: core.getBooleanInput('analyze-pull-requests'),
      pullRequestComments: core.getBooleanInput('analyze-pull-request-comments'),
      discussions: core.getBooleanInput('analyze-discussions'),
      discussionComments: core.getBooleanInput('analyze-discussion-comments')
    }
    options.issueComments = options.issues && options.issueComments
    options.pullRequestComments = options.pullRequests && options.pullRequestComments
    options.discussionComments = options.discussions && options.discussionComments

    const date = new Date()
    const since = core.getInput('since')
      ? new Date(core.getInput('since'))
      : new Date(date.setDate(date.getDate() - parseInt(core.getInput('since-days'))))
    const until = core.getInput('until') ? new Date(core.getInput('until')) : new Date()

    core.debug(`since: ${since}`)
    core.debug(`until: ${until}`)

    const report = await createReport(
      core.getInput('token'),
      core.getInput('organization'),
      since,
      until,
      options
    )

    if (core.getInput('create-json')) {
      fs.writeFileSync(core.getInput('create-json'), report.toJSON(), { encoding: 'utf-8' })
    }
    if (core.getInput('create-csv')) {
      fs.writeFileSync(core.getInput('create-csv'), report.toCSV(), { encoding: 'utf-8' })
    }
    if (core.getBooleanInput('create-summary')) {
      core.summary.addRaw(report.toMarkdown())
      core.summary.write()
    }
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
