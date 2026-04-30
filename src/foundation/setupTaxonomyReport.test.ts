import { describe, expect, it, vi } from 'vitest'

import { buildSetupTaxonomyReport } from './setupTaxonomyReport.js'
import type { MultiMarketComparison } from './multiMarketComparison.js'

vi.mock('./multiMarketReport.js', () => ({
  loadMultiMarketComparisons: vi.fn(),
}))

import { loadMultiMarketComparisons } from './multiMarketReport.js'

function comparisonFromSetup(setupType: 'cross' | 'blocked' | 'watch'): MultiMarketComparison {
  const base = {
    version: 'multi-market-comparison/v1' as const,
    capturedAt: `2026-04-29T00:00:0${setupType === 'cross' ? '0' : setupType === 'blocked' ? '1' : '2'}.000Z`,
    urls: {
      flashscoreMatchUrl: 'https://flashscore.test/m',
      flashscoreSourcePageUrl: 'https://flashscore.test/m',
      kalshiMarketUrl: 'https://kalshi.test/m',
      polymarketMarketUrl: 'https://poly.test/m',
    },
    match: {
      matchId: `m-${setupType}`,
      status: 'LIVE',
      teamA: 'A',
      teamB: 'B',
    },
    quality: { tier: 'high', reasons: [] },
    prematchBaseline: { tourType: 'ATP', completeness: 'complete', surface: 'hard' },
    pFair: { match: { pMatchA: 0.6, pMatchB: 0.4 } },
  } as never

  if (setupType === 'cross') {
    return {
      ...base,
      markets: {
        kalshi: {
          fairVsMarket: { edgeA: { vsLast: 0.02 } },
          liveDecision: { action: 'ignore' },
        },
        polymarket: {
          fairVsMarket: { edgeA: { vsLast: 0.11 } },
          liveDecision: { action: 'candidate' },
        },
      },
      crossMarket: {
        bothAvailable: true,
        marketProbA: { spreadKalshiMinusPolymarket: 0.09 },
      },
    } as never
  }

  if (setupType === 'blocked') {
    return {
      ...base,
      markets: {
        kalshi: {
          fairVsMarket: { edgeA: { vsLast: 0.09 } },
          liveDecision: { action: 'candidate_but_ineligible' },
        },
        polymarket: {
          fairVsMarket: { edgeA: { vsLast: 0.01 } },
          liveDecision: { action: 'ignore' },
        },
      },
      crossMarket: {
        bothAvailable: true,
        marketProbA: { spreadKalshiMinusPolymarket: 0.02 },
      },
    } as never
  }

  return {
    ...base,
    markets: {
      kalshi: {
        fairVsMarket: { edgeA: { vsLast: 0.04 } },
        liveDecision: { action: 'watch_only' },
      },
      polymarket: {
        fairVsMarket: { edgeA: { vsLast: 0.01 } },
        liveDecision: { action: 'ignore' },
      },
    },
    crossMarket: {
      bothAvailable: true,
      marketProbA: { spreadKalshiMinusPolymarket: 0.01 },
    },
  } as never
}

describe('buildSetupTaxonomyReport', () => {
  it('aggregates comparisons into setup buckets', async () => {
    vi.mocked(loadMultiMarketComparisons).mockResolvedValue([
      comparisonFromSetup('cross'),
      comparisonFromSetup('blocked'),
      comparisonFromSetup('watch'),
    ])

    const report = await buildSetupTaxonomyReport('multi-market-comparisons')

    expect(report.comparisonCount).toBe(3)
    expect(report.overallBySetup.find((bucket) => bucket.key === 'cross_market_teamA')?.sampleCount).toBe(1)
    expect(report.overallBySetup.find((bucket) => bucket.key === 'blocked_candidate')?.sampleCount).toBe(1)
    expect(report.overallBySetup.find((bucket) => bucket.key === 'watch_only_dislocation')?.sampleCount).toBe(1)
  })
})
