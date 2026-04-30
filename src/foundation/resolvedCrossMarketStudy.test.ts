import { describe, expect, it } from 'vitest'

import { buildResolvedCrossMarketStudy } from './resolvedCrossMarketStudy.js'

describe('buildResolvedCrossMarketStudy', () => {
  it('builds a resolved cross-market study even when current resolved sample is empty', async () => {
    const study = await buildResolvedCrossMarketStudy('/Users/wen/Desktop/flashscore-tennis-evaluator/tennis-match-winner-alpha-system/multi-market-comparisons')

    expect(study.version).toBe('resolved-cross-market-study/v1')
    expect(study.comparisonCount).toBeGreaterThanOrEqual(1)
    expect(study.resolvedCount).toBeGreaterThanOrEqual(0)
  })
})
