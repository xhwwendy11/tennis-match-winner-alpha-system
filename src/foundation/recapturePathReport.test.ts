import { describe, expect, it, vi } from 'vitest'

import type { MultiMarketComparison } from './multiMarketComparison.js'
import { buildRecapturePathReport } from './recapturePathReport.js'

vi.mock('./multiMarketReport.js', () => ({
  loadMultiMarketComparisons: vi.fn(),
}))

import { loadMultiMarketComparisons } from './multiMarketReport.js'

function createComparison(input: {
  capturedAt: string
  flashscoreMatchUrl: string
  teamA: string
  teamB: string
  kalshiLastA?: number | null
  polymarketLastA?: number | null
  kalshiEdgeA?: number | null
  polymarketEdgeA?: number | null
  kalshiAction?: 'candidate' | 'candidate_but_ineligible' | 'watch_only' | 'ignore'
  polymarketAction?: 'candidate' | 'candidate_but_ineligible' | 'watch_only' | 'ignore'
  kalshiEligible?: boolean
  polymarketEligible?: boolean
  spreadA?: number | null
  tourType?: string
  qualityTier?: 'high' | 'medium' | 'low' | 'unusable'
}): MultiMarketComparison {
  const fairA = 0.6
  return {
    version: 'multi-market-comparison/v1',
    capturedAt: input.capturedAt,
    urls: {
      flashscoreMatchUrl: input.flashscoreMatchUrl,
      flashscoreSourcePageUrl: input.flashscoreMatchUrl,
      kalshiMarketUrl: 'https://kalshi.test/market',
      polymarketMarketUrl: 'https://polymarket.test/market',
    },
    match: {
      matchId: 'm1',
      status: 'LIVE',
      teamA: input.teamA,
      teamB: input.teamB,
      setsWonA: 1,
      setsWonB: 0,
      currentSet: 2,
      gamesA: 3,
      gamesB: 2,
      pointsA: '15',
      pointsB: '0',
      servingSide: 'A',
      scoreboardAvailable: true,
      sourceId: null,
      pointProgression: null,
      sourcePageUrl: input.flashscoreMatchUrl,
      rawPointScore: null,
      setScores: [],
      setsBestOf: 3,
      tiebreak: null,
      rawStatus: 'LIVE',
      rawEventStage: null,
      eventStage: null,
    },
    quality: {
      tier: input.qualityTier || 'high',
      reasons: [],
    },
    prematchBaseline: {
      surface: 'hard',
      tourType: input.tourType || 'ATP',
      completeness: 'complete',
    } as MultiMarketComparison['prematchBaseline'],
    pFair: {
      match: {
        pMatchA: fairA,
        pMatchB: 1 - fairA,
      },
    } as MultiMarketComparison['pFair'],
    markets: {
      kalshi: {
        provider: 'kalshi',
        url: 'https://kalshi.test/market',
        market: null,
        fairVsMarket: {
          marketProbA: { last: input.kalshiLastA ?? null },
          marketProbB: { last: input.kalshiLastA == null ? null : 1 - input.kalshiLastA },
          edgeA: { vsLast: input.kalshiEdgeA ?? null },
          edgeB: { vsLast: input.kalshiEdgeA == null ? null : -input.kalshiEdgeA },
        } as MultiMarketComparison['markets']['kalshi']['fairVsMarket'],
        marketEligibility: {
          eligible: input.kalshiEligible ?? true,
          reasons: [],
          metrics: {} as never,
          rule: {} as never,
        },
        edgeSignal: {} as never,
        liveDecision: { action: input.kalshiAction || 'watch_only', reasons: [] },
      },
      polymarket: {
        provider: 'polymarket',
        url: 'https://polymarket.test/market',
        market: null,
        fairVsMarket: {
          marketProbA: { last: input.polymarketLastA ?? null },
          marketProbB: { last: input.polymarketLastA == null ? null : 1 - input.polymarketLastA },
          edgeA: { vsLast: input.polymarketEdgeA ?? null },
          edgeB: { vsLast: input.polymarketEdgeA == null ? null : -input.polymarketEdgeA },
        } as MultiMarketComparison['markets']['polymarket']['fairVsMarket'],
        marketEligibility: {
          eligible: input.polymarketEligible ?? true,
          reasons: [],
          metrics: {} as never,
          rule: {} as never,
        },
        edgeSignal: {} as never,
        liveDecision: { action: input.polymarketAction || 'ignore', reasons: [] },
      },
    },
    crossMarket: {
      bothAvailable: true,
      marketProbA: {
        kalshiLast: input.kalshiLastA ?? null,
        polymarketLast: input.polymarketLastA ?? null,
        spreadKalshiMinusPolymarket: input.spreadA ?? null,
      },
      marketProbB: {
        kalshiLast: input.kalshiLastA == null ? null : 1 - input.kalshiLastA,
        polymarketLast: input.polymarketLastA == null ? null : 1 - input.polymarketLastA,
        spreadKalshiMinusPolymarket: input.spreadA == null ? null : -input.spreadA,
      },
      betterValueForTeamA: (input.kalshiEdgeA ?? 0) > (input.polymarketEdgeA ?? 0) ? 'kalshi' : 'polymarket',
      betterValueForTeamB: 'tie',
    },
  }
}

describe('buildRecapturePathReport', () => {
  it('groups repeated captures into ordered match paths', async () => {
    vi.mocked(loadMultiMarketComparisons).mockResolvedValue([
      createComparison({
        capturedAt: '2026-04-29T10:00:00.000Z',
        flashscoreMatchUrl: 'https://flashscore.test/m1',
        teamA: 'Player A',
        teamB: 'Player B',
        kalshiLastA: 0.62,
        polymarketLastA: 0.55,
        kalshiEdgeA: -0.02,
        polymarketEdgeA: 0.05,
        kalshiAction: 'watch_only',
        polymarketAction: 'candidate',
        spreadA: 0.07,
      }),
      createComparison({
        capturedAt: '2026-04-29T10:02:00.000Z',
        flashscoreMatchUrl: 'https://flashscore.test/m1',
        teamA: 'Player A',
        teamB: 'Player B',
        kalshiLastA: 0.68,
        polymarketLastA: 0.52,
        kalshiEdgeA: -0.08,
        polymarketEdgeA: 0.08,
        kalshiAction: 'ignore',
        polymarketAction: 'candidate',
        spreadA: 0.16,
      }),
      createComparison({
        capturedAt: '2026-04-29T11:00:00.000Z',
        flashscoreMatchUrl: 'https://flashscore.test/m2',
        teamA: 'Player C',
        teamB: 'Player D',
        kalshiLastA: 0.48,
        polymarketLastA: 0.47,
        kalshiEdgeA: 0.03,
        polymarketEdgeA: 0.02,
        kalshiAction: 'candidate_but_ineligible',
        polymarketAction: 'watch_only',
        spreadA: 0.01,
      }),
    ])

    const report = await buildRecapturePathReport('multi-market-comparisons')

    expect(report.pathCount).toBe(2)
    expect(report.multiCapturePathCount).toBe(1)
    expect(report.meanCapturesPerPath).toBe(1.5)

    const firstPath = report.paths[0]
    expect(firstPath.flashscoreMatchUrl).toBe('https://flashscore.test/m1')
    expect(firstPath.captureCount).toBe(2)
    expect(firstPath.durationSeconds).toBe(120)
    expect(firstPath.kalshi.actionCounts.watchOnly).toBe(1)
    expect(firstPath.kalshi.actionCounts.ignore).toBe(1)
    expect(firstPath.kalshi.actionTransitionCount).toBe(1)
    expect(firstPath.polymarket.actionCounts.candidate).toBe(2)
    expect(firstPath.kalshi.rangeLastA).toBeCloseTo(0.06)
    expect(firstPath.polymarket.rangeLastA).toBeCloseTo(0.03)
    expect(firstPath.crossMarket.rangeSpreadA).toBeCloseTo(0.09)
    expect(firstPath.crossMarket.polymarketBetterValueTeamACount).toBe(2)
  })
})
