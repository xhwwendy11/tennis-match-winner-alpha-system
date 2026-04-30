import { describe, expect, it } from 'vitest'

import { buildMultiMarketComparison } from './multiMarketComparison.js'

const base = {
  decisionSnapshot: {
    capturedAt: '2026-04-29T04:20:00.000Z',
    urls: {
      flashscoreMatchUrl: 'https://www.flashscore.com/match/tennis/foo/bar/',
      flashscoreSourcePageUrl: 'https://www.flashscore.com/match/tennis/foo/bar/?mid=abc',
      kalshiMarketUrl: null,
      polymarketMarketUrl: null,
    },
    match: {
      matchId: 'abc',
      tournamentName: 'Huzhou',
      round: '1/8-finals',
      gender: 'women',
      discipline: 'singles',
      teamA: 'Veronika Erjavec',
      teamB: 'Sofya Lansere',
      status: 'LIVE',
      abnormalReason: 'none',
      setIndex: 1,
      isTiebreak: false,
      setsWonA: 0,
      setsWonB: 0,
      currentSetGamesA: 3,
      currentSetGamesB: 3,
      currentGamePointsA: '40',
      currentGamePointsB: '30',
      serverSide: 'teamA',
      matchIntegrity: 'ok',
    },
    quality: {
      tier: 'high',
      reason: 'official_baseline_live_stats',
      unsupported: false,
    },
  },
  prematchBaseline: {
    source: 'tour_official',
    complete: true,
  },
  probabilityState: {
    pFair: {
      match: {
        pMatchA: 0.6,
        pMatchB: 0.4,
      },
    },
  },
  canonicalMatchState: {
    participants: {
      teamA: { name: 'Veronika Erjavec', shortName: 'Erjavec', code: 'ERJ', slug: 'erjavec' },
      teamB: { name: 'Sofya Lansere', shortName: 'Lansere', code: 'LAN', slug: 'lansere' },
    },
  },
} as never

describe('buildMultiMarketComparison', () => {
  it('compares both markets against the same fair anchor', () => {
    const comparison = buildMultiMarketComparison({
      base,
      kalshiMarketUrl: 'https://kalshi.com/markets/foo',
      polymarketMarketUrl: 'https://polymarket.com/sports/wta/foo',
      kalshiMarketState: {
        provider: 'kalshi',
        eventTicker: 'kalshi-event',
        marketTicker: 'kalshi-market',
        marketTitle: 'Veronika Erjavec vs Sofya Lansere',
        marketStatus: 'OPEN',
        prices: { yesBid: 53, yesAsk: 55, noBid: 45, noAsk: 47, lastPrice: 54 },
        liquidity: { volume: 800000 },
        timestamps: { marketTimestamp: '2026-04-29T04:19:55.000Z' },
      },
      polymarketMarketState: {
        provider: 'polymarket',
        eventTicker: 'poly-event',
        marketTicker: 'poly-market',
        marketTitle: 'Veronika Erjavec vs Sofya Lansere',
        marketStatus: 'OPEN',
        prices: { yesBid: 61, yesAsk: 62, noBid: 38, noAsk: 39, lastPrice: 61 },
        liquidity: { volume: 9000 },
        timestamps: { marketTimestamp: '2026-04-29T04:18:30.000Z' },
      },
    })

    expect(comparison.markets.kalshi?.fairVsMarket.fairProbA).toBeCloseTo(0.6, 6)
    expect(comparison.markets.polymarket?.fairVsMarket.fairProbA).toBeCloseTo(0.6, 6)
    expect(comparison.crossMarket.marketProbA.spreadKalshiMinusPolymarket).toBeCloseTo(-0.07, 6)
    expect(comparison.crossMarket.betterValueForTeamA).toBe('kalshi')
    expect(comparison.crossMarket.betterValueForTeamB).toBe('polymarket')
  })
})
