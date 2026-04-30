import { describe, expect, it } from 'vitest'

import { buildMultiMarketReport } from './multiMarketReport.js'

describe('buildMultiMarketReport', () => {
  it('aggregates multi-market comparison files', async () => {
    const report = await buildMultiMarketReport('/Users/wen/Desktop/flashscore-tennis-evaluator/tennis-match-winner-alpha-system/multi-market-comparisons')

    expect(report.version).toBe('multi-market-report/v1')
    expect(report.comparisonCount).toBeGreaterThanOrEqual(1)
    expect(report.bothAvailableCount).toBeGreaterThanOrEqual(1)
    expect(report.overall.sampleCount).toBe(report.comparisonCount)
  })
})
