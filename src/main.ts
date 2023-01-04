import * as core from '@actions/core'
import { createReport } from './report'

async function run(): Promise<void> {
  try {

    await createReport(
      core.getInput('token'),
      core.getInput('organization')
    )
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
