import { describe, expect, it } from 'vitest'

import { buildProviderDeviationReport } from './providerDeviationReport.js'

describe('buildProviderDeviationReport', () => {
  it('aggregates provider-level deviation from existing multi-market comparisons', async () => {
    const report = await buildProviderDeviationReport('/Users/wen/Desktop/flashscore-tennis-evaluator/tennis-match-winner-alpha-system/multi-market-comparisons')

    expect(report.version).toBe('provider-deviation-report/v1')
    expect(report.comparisonCount).toBeGreaterThanOrEqual(1)
    expect(report.providerSampleCount).toBeGreaterThanOrEqual(2)
    expect(report.overallByProvider.some((bucket) => bucket.key === 'kalshi')).toBe(true)
    expect(report.overallByProvider.some((bucket) => bucket.key === 'polymarket')).toBe(true)
  })
})
