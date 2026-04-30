import { describe, expect, it } from 'vitest'

import { classifyTradeSetup } from './setupTaxonomy.js'
import type { MultiMarketComparison } from './multiMarketComparison.js'

function buildComparison(input: {
  kalshiAction: 'candidate' | 'candidate_but_ineligible' | 'watch_only' | 'ignore'
  polymarketAction: 'candidate' | 'candidate_but_ineligible' | 'watch_only' | 'ignore'
  kalshiEdgeA?: number | null
  kalshiEdgeB?: number | null
  polymarketEdgeA?: number | null
  polymarketEdgeB?: number | null
  spreadA?: number | null
  bothAvailable?: boolean
}): MultiMarketComparison {
  return {
    version: 'multi-market-comparison/v1',
    capturedAt: '2026-04-29T00:00:00.000Z',
    urls: {
      flashscoreMatchUrl: 'https://flashscore.test/m1',
      flashscoreSourcePageUrl: 'https://flashscore.test/m1',
      kalshiMarketUrl: 'https://kalshi.test/m1',
      polymarketMarketUrl: 'https://poly.test/m1',
    },
    match: {
      matchId: 'm1',
      status: 'LIVE',
      teamA: 'A',
      teamB: 'B',
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
      sourcePageUrl: null,
      rawPointScore: null,
      setScores: [],
      setsBestOf: 3,
      tiebreak: null,
      rawStatus: 'LIVE',
      rawEventStage: null,
      eventStage: null,
    },
    quality: { tier: 'high', reasons: [] },
    prematchBaseline: { tourType: 'ATP', completeness: 'complete', surface: 'hard' } as never,
    pFair: { match: { pMatchA: 0.6, pMatchB: 0.4 } } as never,
    markets: {
      kalshi: {
        provider: 'kalshi',
        url: 'https://kalshi.test/m1',
        market: null,
        fairVsMarket: {
          edgeA: { vsLast: input.kalshiEdgeA ?? null },
          edgeB: { vsLast: input.kalshiEdgeB ?? null },
        } as never,
        marketEligibility: { eligible: true, reasons: [], metrics: {} as never, rule: {} as never },
        edgeSignal: {} as never,
        liveDecision: {
          action: input.kalshiAction,
          side: (input.kalshiEdgeA ?? 0) >= (input.kalshiEdgeB ?? 0) ? 'teamA' : 'teamB',
          strength: 'strong',
          edgeVsLast: Math.max(Math.abs(input.kalshiEdgeA ?? 0), Math.abs(input.kalshiEdgeB ?? 0)),
          marketEligible: input.kalshiAction !== 'candidate_but_ineligible',
          reason: '',
          blockedBy: [],
        },
      },
      polymarket: {
        provider: 'polymarket',
        url: 'https://poly.test/m1',
        market: null,
        fairVsMarket: {
          edgeA: { vsLast: input.polymarketEdgeA ?? null },
          edgeB: { vsLast: input.polymarketEdgeB ?? null },
        } as never,
        marketEligibility: { eligible: true, reasons: [], metrics: {} as never, rule: {} as never },
        edgeSignal: {} as never,
        liveDecision: {
          action: input.polymarketAction,
          side: (input.polymarketEdgeA ?? 0) >= (input.polymarketEdgeB ?? 0) ? 'teamA' : 'teamB',
          strength: 'strong',
          edgeVsLast: Math.max(Math.abs(input.polymarketEdgeA ?? 0), Math.abs(input.polymarketEdgeB ?? 0)),
          marketEligible: input.polymarketAction !== 'candidate_but_ineligible',
          reason: '',
          blockedBy: [],
        },
      },
    },
    crossMarket: {
      bothAvailable: input.bothAvailable ?? true,
      marketProbA: {
        kalshiLast: 0.7,
        polymarketLast: 0.6,
        spreadKalshiMinusPolymarket: input.spreadA ?? null,
      },
      marketProbB: {
        kalshiLast: 0.3,
        polymarketLast: 0.4,
        spreadKalshiMinusPolymarket: input.spreadA == null ? null : -input.spreadA,
      },
      betterValueForTeamA: 'polymarket',
      betterValueForTeamB: 'kalshi',
    },
  }
}

describe('classifyTradeSetup', () => {
  it('classifies cross-market teamA setups', () => {
    const comparison = buildComparison({
      kalshiAction: 'ignore',
      polymarketAction: 'candidate',
      kalshiEdgeA: 0.02,
      polymarketEdgeA: 0.11,
      spreadA: 0.09,
    })
    const setup = classifyTradeSetup(comparison)
    expect(setup.type).toBe('cross_market_teamA')
    expect(setup.primaryProvider).toBe('polymarket')
  })

  it('classifies blocked candidates', () => {
    const comparison = buildComparison({
      kalshiAction: 'candidate_but_ineligible',
      polymarketAction: 'ignore',
      kalshiEdgeA: 0.09,
      spreadA: 0.02,
    })
    const setup = classifyTradeSetup(comparison)
    expect(setup.type).toBe('blocked_candidate')
    expect(setup.primaryProvider).toBe('kalshi')
  })

  it('falls back to watch-only and no-setup states', () => {
    const watchOnly = classifyTradeSetup(
      buildComparison({
        kalshiAction: 'watch_only',
        polymarketAction: 'ignore',
        kalshiEdgeA: 0.04,
        spreadA: 0.01,
      }),
    )
    expect(watchOnly.type).toBe('watch_only_dislocation')

    const none = classifyTradeSetup(
      buildComparison({
        kalshiAction: 'ignore',
        polymarketAction: 'ignore',
        kalshiEdgeA: 0.01,
        polymarketEdgeA: 0.02,
        spreadA: 0.01,
      }),
    )
    expect(none.type).toBe('no_setup')
  })
})
