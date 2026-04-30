import { describe, expect, it, vi } from 'vitest'

import { buildExecutionDataset, buildExecutionDatasetRows } from './executionDataset.js'
import type { MultiMarketComparison } from './multiMarketComparison.js'

vi.mock('./multiMarketReport.js', () => ({
  loadMultiMarketComparisons: vi.fn(),
}))

import { loadMultiMarketComparisons } from './multiMarketReport.js'

function makeComparison(input: {
  setup: 'cross' | 'blocked' | 'watch'
}): MultiMarketComparison {
  if (input.setup === 'cross') {
    return {
      version: 'multi-market-comparison/v1',
      capturedAt: '2026-04-29T10:00:00.000Z',
      urls: {
        flashscoreMatchUrl: 'https://flashscore.test/m1',
        flashscoreSourcePageUrl: 'https://flashscore.test/m1',
        kalshiMarketUrl: 'https://kalshi.test/m1',
        polymarketMarketUrl: 'https://poly.test/m1',
      },
      match: { matchId: 'm1', teamA: 'A', teamB: 'B' } as never,
      quality: { tier: 'high', reasons: [] },
      prematchBaseline: { tourType: 'ATP_CHALLENGER' } as never,
      pFair: { match: { pMatchA: 0.72, pMatchB: 0.28 } } as never,
      markets: {
        kalshi: {
          url: 'https://kalshi.test/m1',
          fairVsMarket: {
            marketProbA: { bid: 0.69, ask: 0.71, mid: 0.7, last: 0.7 },
            marketProbB: { bid: 0.29, ask: 0.31, mid: 0.3, last: 0.3 },
            edgeA: { vsBid: 0.03, vsAsk: 0.01, vsMid: 0.02, vsLast: 0.02 },
            edgeB: { vsBid: -0.01, vsAsk: -0.03, vsMid: -0.02, vsLast: -0.02 },
          },
          marketEligibility: { eligible: false },
          liveDecision: { action: 'ignore', blockedBy: [] },
        },
        polymarket: {
          url: 'https://poly.test/m1',
          fairVsMarket: {
            marketProbA: { bid: 0.6, ask: 0.62, mid: 0.61, last: 0.61 },
            marketProbB: { bid: 0.38, ask: 0.4, mid: 0.39, last: 0.39 },
            edgeA: { vsBid: 0.12, vsAsk: 0.1, vsMid: 0.11, vsLast: 0.11 },
            edgeB: { vsBid: -0.1, vsAsk: -0.12, vsMid: -0.11, vsLast: -0.11 },
          },
          marketEligibility: { eligible: true },
          liveDecision: { action: 'candidate', blockedBy: [] },
        },
      } as never,
      crossMarket: {
        bothAvailable: true,
        marketProbA: { spreadKalshiMinusPolymarket: 0.09 },
        marketProbB: { spreadKalshiMinusPolymarket: -0.09 },
      } as never,
    }
  }

  if (input.setup === 'blocked') {
    return {
      version: 'multi-market-comparison/v1',
      capturedAt: '2026-04-29T10:01:00.000Z',
      urls: {
        flashscoreMatchUrl: 'https://flashscore.test/m2',
        flashscoreSourcePageUrl: 'https://flashscore.test/m2',
        kalshiMarketUrl: 'https://kalshi.test/m2',
        polymarketMarketUrl: 'https://poly.test/m2',
      },
      match: { matchId: 'm2', teamA: 'A', teamB: 'B' } as never,
      quality: { tier: 'high', reasons: [] },
      prematchBaseline: { tourType: 'ATP' } as never,
      pFair: { match: { pMatchA: 0.62, pMatchB: 0.38 } } as never,
      markets: {
        kalshi: {
          url: 'https://kalshi.test/m2',
          fairVsMarket: {
            marketProbA: { bid: 0.51, ask: 0.53, mid: 0.52, last: 0.52 },
            marketProbB: { bid: 0.47, ask: 0.49, mid: 0.48, last: 0.48 },
            edgeA: { vsBid: 0.11, vsAsk: 0.09, vsMid: 0.1, vsLast: 0.1 },
            edgeB: { vsBid: -0.09, vsAsk: -0.11, vsMid: -0.1, vsLast: -0.1 },
          },
          marketEligibility: { eligible: false },
          liveDecision: { action: 'candidate_but_ineligible', side: 'teamA', blockedBy: ['low_volume'] },
        },
        polymarket: {
          url: 'https://poly.test/m2',
          fairVsMarket: {
            marketProbA: { bid: 0.57, ask: 0.59, mid: 0.58, last: 0.58 },
            marketProbB: { bid: 0.41, ask: 0.43, mid: 0.42, last: 0.42 },
            edgeA: { vsBid: 0.05, vsAsk: 0.03, vsMid: 0.04, vsLast: 0.04 },
            edgeB: { vsBid: -0.03, vsAsk: -0.05, vsMid: -0.04, vsLast: -0.04 },
          },
          marketEligibility: { eligible: true },
          liveDecision: { action: 'ignore', blockedBy: [] },
        },
      } as never,
      crossMarket: {
        bothAvailable: true,
        marketProbA: { spreadKalshiMinusPolymarket: -0.06 },
        marketProbB: { spreadKalshiMinusPolymarket: 0.06 },
      } as never,
    }
  }

  return {
    version: 'multi-market-comparison/v1',
    capturedAt: '2026-04-29T10:02:00.000Z',
    urls: {
      flashscoreMatchUrl: 'https://flashscore.test/m3',
      flashscoreSourcePageUrl: 'https://flashscore.test/m3',
      kalshiMarketUrl: 'https://kalshi.test/m3',
      polymarketMarketUrl: 'https://poly.test/m3',
    },
    match: { matchId: 'm3', teamA: 'A', teamB: 'B' } as never,
    quality: { tier: 'medium', reasons: [] },
    prematchBaseline: { tourType: 'WTA' } as never,
    pFair: { match: { pMatchA: 0.41, pMatchB: 0.59 } } as never,
    markets: {
      kalshi: {
        url: 'https://kalshi.test/m3',
        fairVsMarket: {
          marketProbA: { bid: 0.43, ask: 0.45, mid: 0.44, last: 0.44 },
          marketProbB: { bid: 0.55, ask: 0.57, mid: 0.56, last: 0.56 },
          edgeA: { vsBid: -0.02, vsAsk: -0.04, vsMid: -0.03, vsLast: -0.03 },
          edgeB: { vsBid: 0.04, vsAsk: 0.02, vsMid: 0.03, vsLast: 0.03 },
        },
        marketEligibility: { eligible: true },
        liveDecision: { action: 'watch_only', side: 'teamA', blockedBy: [] },
      },
      polymarket: {
        url: 'https://poly.test/m3',
        fairVsMarket: {
          marketProbA: { bid: 0.38, ask: 0.4, mid: 0.39, last: 0.39 },
          marketProbB: { bid: 0.6, ask: 0.62, mid: 0.61, last: 0.61 },
          edgeA: { vsBid: 0.03, vsAsk: 0.01, vsMid: 0.02, vsLast: 0.02 },
          edgeB: { vsBid: -0.01, vsAsk: -0.03, vsMid: -0.02, vsLast: -0.02 },
        },
        marketEligibility: { eligible: true },
        liveDecision: { action: 'ignore', side: 'teamA', blockedBy: [] },
      },
    } as never,
    crossMarket: {
      bothAvailable: true,
      marketProbA: { spreadKalshiMinusPolymarket: 0.05 },
      marketProbB: { spreadKalshiMinusPolymarket: -0.05 },
    } as never,
  }
}

describe('execution dataset', () => {
  it('builds provider-level rows for cross-market setups', () => {
    const rows = buildExecutionDatasetRows(makeComparison({ setup: 'cross' }))
    expect(rows).toHaveLength(2)
    expect(rows[0]?.setupType).toBe('cross_market_teamA')
    expect(rows.some((row) => row.legRole === 'cheap_leg')).toBe(true)
    expect(rows.some((row) => row.legRole === 'rich_leg')).toBe(true)
  })

  it('keeps blocked and watch-only rows in dataset shape', () => {
    const blocked = buildExecutionDatasetRows(makeComparison({ setup: 'blocked' }))
    expect(blocked).toHaveLength(1)
    expect(blocked[0]?.actionability).toBe('blocked_candidate')

    const watch = buildExecutionDatasetRows(makeComparison({ setup: 'watch' }))
    expect(watch).toHaveLength(1)
    expect(watch[0]?.actionability).toBe('watch_only')
  })

  it('aggregates dataset from loaded comparisons', async () => {
    vi.mocked(loadMultiMarketComparisons).mockResolvedValue([
      makeComparison({ setup: 'cross' }),
      makeComparison({ setup: 'blocked' }),
      makeComparison({ setup: 'watch' }),
    ])

    const dataset = await buildExecutionDataset('multi-market-comparisons')
    expect(dataset.comparisonCount).toBe(3)
    expect(dataset.rowCount).toBe(4)
  })
})
