import { expect, test } from '@jest/globals'
import { ReportData } from '../src/reportData'

test('test 1', async () => {
  const report = new ReportData('org')

  report.addCommit('user1')

  expect(report.getOrCreateUserData('user1').commits).toBe(1)
  expect(report.getOrCreateUserData('user1').isActive).toBe(true)
})

test('test 2', async () => {
  const report = new ReportData('org')

  expect(report.getOrCreateUserData('user1').isActive).toBe(false)
})
