import { describe, expect, it, vi } from 'vitest'

import { buildSetupOutcomeStudy } from './setupOutcomeStudy.js'

vi.mock('./multiMarketReport.js', () => ({
  loadMultiMarketComparisons: vi.fn(),
}))

vi.mock('./resolvedOutcome.js', async () => {
  const actual = await vi.importActual<typeof import('./resolvedOutcome.js')>('./resolvedOutcome.js')
  return {
    ...actual,
    loadResolvedOutcomeIndex: vi.fn(),
  }
})

import { loadMultiMarketComparisons } from './multiMarketReport.js'
import { loadResolvedOutcomeIndex } from './resolvedOutcome.js'
import type { MultiMarketComparison } from './multiMarketComparison.js'
import type { ResolvedMatchOutcome } from './resolvedOutcome.js'

function makeComparison(input: {
  matchId: string
  capturedAt: string
  pFairA: number
  kalshiLastA: number | null
  polymarketLastA: number | null
  kalshiAction: 'candidate' | 'candidate_but_ineligible' | 'watch_only' | 'ignore'
  polymarketAction: 'candidate' | 'candidate_but_ineligible' | 'watch_only' | 'ignore'
  spreadA: number | null
  kalshiEdgeA: number | null
  polymarketEdgeA: number | null
}): MultiMarketComparison {
  return {
    version: 'multi-market-comparison/v1',
    capturedAt: input.capturedAt,
    urls: {
      flashscoreMatchUrl: `https://flashscore.test/${input.matchId}`,
      flashscoreSourcePageUrl: `https://flashscore.test/${input.matchId}`,
      kalshiMarketUrl: 'https://kalshi.test/m',
      polymarketMarketUrl: 'https://poly.test/m',
    },
    match: {
      matchId: input.matchId,
      status: 'LIVE',
      teamA: 'A',
      teamB: 'B',
    } as never,
    quality: { tier: 'high', reasons: [] },
    prematchBaseline: { tourType: 'ATP_CHALLENGER', completeness: 'complete', surface: 'hard' } as never,
    pFair: { match: { pMatchA: input.pFairA, pMatchB: 1 - input.pFairA } } as never,
    markets: {
      kalshi: {
        fairVsMarket: { marketProbA: { last: input.kalshiLastA }, edgeA: { vsLast: input.kalshiEdgeA }, edgeB: { vsLast: input.kalshiEdgeA == null ? null : -input.kalshiEdgeA } } as never,
        liveDecision: { action: input.kalshiAction, side: 'teamA', strength: 'strong', edgeVsLast: input.kalshiEdgeA, marketEligible: input.kalshiAction !== 'candidate_but_ineligible', reason: '', blockedBy: [] },
      },
      polymarket: {
        fairVsMarket: { marketProbA: { last: input.polymarketLastA }, edgeA: { vsLast: input.polymarketEdgeA }, edgeB: { vsLast: input.polymarketEdgeA == null ? null : -input.polymarketEdgeA } } as never,
        liveDecision: { action: input.polymarketAction, side: 'teamA', strength: 'strong', edgeVsLast: input.polymarketEdgeA, marketEligible: input.polymarketAction !== 'candidate_but_ineligible', reason: '', blockedBy: [] },
      },
    } as never,
    crossMarket: {
      bothAvailable: true,
      marketProbA: { spreadKalshiMinusPolymarket: input.spreadA },
    } as never,
  }
}

describe('buildSetupOutcomeStudy', () => {
  it('aggregates resolved rows by setup type', async () => {
    vi.mocked(loadMultiMarketComparisons).mockResolvedValue([
      makeComparison({
        matchId: 'm1',
        capturedAt: '2026-04-29T10:00:00.000Z',
        pFairA: 0.72,
        kalshiLastA: 0.7,
        polymarketLastA: 0.61,
        kalshiAction: 'ignore',
        polymarketAction: 'candidate',
        spreadA: 0.09,
        kalshiEdgeA: 0.02,
        polymarketEdgeA: 0.11,
      }),
      makeComparison({
        matchId: 'm2',
        capturedAt: '2026-04-29T10:05:00.000Z',
        pFairA: 0.41,
        kalshiLastA: 0.44,
        polymarketLastA: 0.39,
        kalshiAction: 'watch_only',
        polymarketAction: 'ignore',
        spreadA: 0.05,
        kalshiEdgeA: -0.03,
        polymarketEdgeA: 0.02,
      }),
    ])

    const outcomes = new Map<string, ResolvedMatchOutcome>()
    outcomes.set('id:m1', {
      version: 'resolved-match-outcome/v1',
      resolvedAt: '2026-04-29T12:00:00.000Z',
      source: 'flashscore',
      matchId: 'm1',
      flashscoreMatchUrl: 'https://flashscore.test/m1',
      teamA: 'A',
      teamB: 'B',
      status: 'FINAL',
      setsWonA: 2,
      setsWonB: 0,
      winner: 'teamA',
      confidence: 'high',
      reason: 'final_score_sets',
    })
    outcomes.set('id:m2', {
      version: 'resolved-match-outcome/v1',
      resolvedAt: '2026-04-29T12:00:00.000Z',
      source: 'flashscore',
      matchId: 'm2',
      flashscoreMatchUrl: 'https://flashscore.test/m2',
      teamA: 'A',
      teamB: 'B',
      status: 'FINAL',
      setsWonA: 0,
      setsWonB: 2,
      winner: 'teamB',
      confidence: 'high',
      reason: 'final_score_sets',
    })

    vi.mocked(loadResolvedOutcomeIndex).mockResolvedValue(outcomes)

    const report = await buildSetupOutcomeStudy('multi-market-comparisons', {
      outcomeRootDir: 'data/outcomes/flashscore',
    })

    expect(report.resolvedCount).toBe(2)
    expect(report.overallBySetup.find((bucket) => bucket.key === 'cross_market_teamA')?.correctDirectionRate).toBe(1)
    expect(report.overallBySetup.find((bucket) => bucket.key === 'watch_only_dislocation')?.sampleCount).toBe(1)
  })
})
