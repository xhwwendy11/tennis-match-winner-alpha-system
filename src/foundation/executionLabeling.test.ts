import { describe, expect, it } from 'vitest'

import { labelExecutionRow } from './executionLabeling.js'
import type { ExecutionDatasetRow } from './executionDataset.js'
import type { MultiMarketComparison } from './multiMarketComparison.js'

function makeComparison(input: {
  capturedAt: string
  askA: number | null
  bidA: number | null
  lastA: number | null
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
    match: { matchId: 'm1', teamA: 'A', teamB: 'B' } as never,
    quality: { tier: 'high', reasons: [] },
    prematchBaseline: { tourType: 'ATP' } as never,
    pFair: { match: { pMatchA: 0.7, pMatchB: 0.3 } } as never,
    markets: {
      kalshi: {
        fairVsMarket: {
          marketProbA: { bid: input.bidA, ask: input.askA, last: input.lastA },
          marketProbB: { bid: null, ask: null, last: null },
        },
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

function makeRow(): ExecutionDatasetRow {
  return {
    version: 'execution-dataset-row/v1',
    capturedAt: '2026-04-29T10:00:00.000Z',
    matchId: 'm1',
    flashscoreMatchUrl: 'https://flashscore.test/m1',
    teamA: 'A',
    teamB: 'B',
    tourType: 'ATP',
    qualityTier: 'high',
    provider: 'kalshi',
    providerUrl: 'https://kalshi.test/m1',
    setupType: 'single_market_kalshi_teamA',
    setupReason: 'test',
    legRole: 'single_market',
    actionability: 'direct_candidate',
    side: 'teamA',
    marketEligible: true,
    liveDecisionAction: 'candidate',
    blockedBy: [],
    pFairSide: 0.7,
    pFairOtherSide: 0.3,
    marketBidSide: 0.6,
    marketAskSide: 0.61,
    marketMidSide: 0.605,
    marketLastSide: 0.61,
    edgeVsBidSide: 0.1,
    edgeVsAskSide: 0.09,
    edgeVsMidSide: 0.095,
    edgeVsLastSide: 0.09,
    spreadSide: 0.01,
    crossSpreadSameSide: null,
    quoteHypotheses: {
      passivePrice: 0.6,
      aggressivePrice: 0.61,
      passiveTouchLabel: null,
      fillBeforeMoveLabel: null,
    },
  }
}

describe('execution labeling', () => {
  it('detects passive touch before adverse move', () => {
    const current = makeComparison({ capturedAt: '2026-04-29T10:00:00.000Z', askA: 0.61, bidA: 0.6, lastA: 0.61 })
    const futureTouch = makeComparison({ capturedAt: '2026-04-29T10:02:00.000Z', askA: 0.6, bidA: 0.59, lastA: 0.6 })
    const futureUp = makeComparison({ capturedAt: '2026-04-29T10:04:00.000Z', askA: 0.64, bidA: 0.62, lastA: 0.63 })

    const labels = labelExecutionRow(makeRow(), current, [current, futureTouch, futureUp])
    expect(labels.futureCaptureCount).toBe(2)
    expect(labels.passiveTouch).toBe(true)
    expect(labels.passiveTouchAtSeconds).toBe(120)
    expect(labels.passiveFillBeforeAdverse).toBe(true)
  })

  it('detects adverse move before passive touch', () => {
    const current = makeComparison({ capturedAt: '2026-04-29T10:00:00.000Z', askA: 0.61, bidA: 0.6, lastA: 0.61 })
    const futureUp = makeComparison({ capturedAt: '2026-04-29T10:02:00.000Z', askA: 0.64, bidA: 0.62, lastA: 0.63 })
    const futureTouchLate = makeComparison({ capturedAt: '2026-04-29T10:04:00.000Z', askA: 0.6, bidA: 0.59, lastA: 0.6 })

    const labels = labelExecutionRow(makeRow(), current, [current, futureUp, futureTouchLate])
    expect(labels.adverseMoveBeforePassive).toBe(true)
    expect(labels.passiveFillBeforeAdverse).toBe(false)
    expect(labels.adverseMoveAtSeconds).toBe(120)
  })
})
