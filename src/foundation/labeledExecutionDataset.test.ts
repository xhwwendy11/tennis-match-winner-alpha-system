import { describe, expect, it, vi } from 'vitest'

import { buildLabeledExecutionDataset } from './labeledExecutionDataset.js'

vi.mock('./multiMarketReport.js', () => ({
  loadMultiMarketComparisons: vi.fn(),
}))

import { loadMultiMarketComparisons } from './multiMarketReport.js'
import type { MultiMarketComparison } from './multiMarketComparison.js'

function makeComparison(input: {
  capturedAt: string
  matchId?: string
  askA: number
  bidA: number
  lastA: number
  action?: 'candidate' | 'ignore'
}): MultiMarketComparison {
  return {
    version: 'multi-market-comparison/v1',
    capturedAt: input.capturedAt,
    urls: {
      flashscoreMatchUrl: 'https://flashscore.test/m1',
      flashscoreSourcePageUrl: 'https://flashscore.test/m1',
      kalshiMarketUrl: 'https://kalshi.test/m1',
      polymarketMarketUrl: 'https://poly.test/m1',
    },
    match: { matchId: input.matchId || 'm1', teamA: 'A', teamB: 'B' } as never,
    quality: { tier: 'high', reasons: [] },
    prematchBaseline: { tourType: 'ATP' } as never,
    pFair: { match: { pMatchA: 0.72, pMatchB: 0.28 } } as never,
    markets: {
      kalshi: {
        url: 'https://kalshi.test/m1',
        fairVsMarket: {
          marketProbA: { bid: input.bidA, ask: input.askA, mid: (input.bidA + input.askA) / 2, last: input.lastA },
          marketProbB: { bid: 1 - input.askA, ask: 1 - input.bidA, mid: 1 - (input.bidA + input.askA) / 2, last: 1 - input.lastA },
          edgeA: { vsBid: 0.72 - input.bidA, vsAsk: 0.72 - input.askA, vsMid: 0.72 - (input.bidA + input.askA) / 2, vsLast: 0.72 - input.lastA },
          edgeB: { vsBid: null, vsAsk: null, vsMid: null, vsLast: null },
        },
        marketEligibility: { eligible: true },
        liveDecision: { action: input.action || 'candidate', side: 'teamA', edgeVsLast: 0.72 - input.lastA, blockedBy: [] },
      },
      polymarket: null,
    } as never,
    crossMarket: {
      bothAvailable: false,
      marketProbA: { spreadKalshiMinusPolymarket: null },
      marketProbB: { spreadKalshiMinusPolymarket: null },
    } as never,
  }
}

describe('labeled execution dataset', () => {
  it('attaches future execution labels to dataset rows', async () => {
    vi.mocked(loadMultiMarketComparisons).mockResolvedValue([
      makeComparison({ capturedAt: '2026-04-29T10:00:00.000Z', askA: 0.61, bidA: 0.6, lastA: 0.61 }),
      makeComparison({ capturedAt: '2026-04-29T10:02:00.000Z', askA: 0.6, bidA: 0.59, lastA: 0.6 }),
    ])

    const dataset = await buildLabeledExecutionDataset('multi-market-comparisons', { includeWatchOnly: true, includeBlocked: true })
    expect(dataset.rowCount).toBe(2)
    expect(dataset.labeledRowCount).toBe(1)
    expect(dataset.rows[0]?.executionLabels.passiveTouch).toBe(true)
    expect(dataset.rows[1]?.executionLabels.futureCaptureCount).toBe(0)
  })
})
