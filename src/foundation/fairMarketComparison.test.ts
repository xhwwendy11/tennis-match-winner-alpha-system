import { describe, expect, it } from 'vitest'

import { buildFairMarketComparison } from './fairMarketComparison.js'
import type { CanonicalMatchState } from './canonicalMatchState.js'

function makeMatchState(): CanonicalMatchState {
  return {
    matchId: 'match-1',
    source: {
      sourceKind: 'flashscore',
      matchUrl: null,
      sourcePageUrl: null,
    },
    competition: {
      tournamentName: 'Savannah',
      tournamentLabel: 'Savannah',
      tournamentPath: null,
      round: '1/16-finals',
      bestOf: 3,
      tourType: 'ATP_CHALLENGER',
      gender: 'men',
      startTimeISO: null,
    },
    participants: {
      teamA: { name: 'Michael Antonius', shortName: 'Antonius', code: 'ANT', slug: 'antonius-michael', playerId: 'a1' },
      teamB: { name: 'Mitchell Krueger', shortName: 'Krueger', code: 'KRU', slug: 'krueger-mitchell', playerId: 'b1' },
    },
    status: {
      matchStatus: 'LIVE',
      statusText: 'Live',
      abnormalReason: 'none',
    },
    scoreboard: {
      setIndex: 2,
      setsWonA: 1,
      setsWonB: 0,
      currentSetGamesA: 1,
      currentSetGamesB: 3,
      currentGamePointsA: '30',
      currentGamePointsB: '0',
      isTiebreak: false,
    },
    serve: {
      raw: 'teamB',
      resolved: 'teamB',
      source: 'dom',
      confidence: 'high',
      syncState: 'synced',
    },
    quality: {
      matchIntegrity: 'ok',
    },
    stats: {
      acesA: null,
      acesB: null,
      firstServePercentageA: null,
      firstServePercentageB: null,
      pointsWonA: null,
      pointsWonB: null,
      firstServeWonA: null,
      firstServeWonB: null,
      secondServeWonA: null,
      secondServeWonB: null,
      servicePointsWonA: null,
      servicePointsWonB: null,
      firstServeReturnPointsWonA: null,
      firstServeReturnPointsWonB: null,
      secondServeReturnPointsWonA: null,
      secondServeReturnPointsWonB: null,
      returnPointsWonA: null,
      returnPointsWonB: null,
      serviceGamesWonA: null,
      serviceGamesWonB: null,
      returnGamesWonA: null,
      returnGamesWonB: null,
      breakPointsSavedA: null,
      breakPointsSavedB: null,
      breakPointsConvertedA: null,
      breakPointsConvertedB: null,
      breakPointsDisplayA: null,
      breakPointsDisplayB: null,
      doubleFaultsA: null,
      doubleFaultsB: null,
    },
    timestamps: {
      ingestedAt: '2026-04-21T18:00:00Z',
      scoreTimestamp: null,
      serveTimestamp: null,
      statsTimestamp: null,
    },
  }
}

const pFair = {
  version: 'p-fair/v1',
  point: { serverSide: 'teamA', pPointA: 0.58, pPointB: 0.42, source: 'derived' },
  game: { serverSide: 'teamA', pGameA: 0.72, pGameB: 0.28, pHoldServer: 0.72, pBreakReceiver: 0.28, source: 'derived' },
  set: { pSetA: 0.63, pSetB: 0.37, source: 'derived' },
  match: { pMatchA: 0.61, pMatchB: 0.39, source: 'derived' },
  anchor: {
    prematchFairProbA: 0.59,
    prematchFairProbB: 0.41,
    holdBaselineA: 0.81,
    holdBaselineB: 0.77,
    breakBaselineA: 0.23,
    breakBaselineB: 0.19,
  },
  diagnostics: {
    setIndex: 2,
    isTiebreak: false,
    pointScoreA: '30',
    pointScoreB: '30',
    gameScoreA: 4,
    gameScoreB: 3,
    riskRule: '4-3 30-30 leader serving',
    integrity: 'ok',
    statsAdjustmentA: 0.01,
    statsAdjustmentB: -0.01,
  },
} as const

describe('buildFairMarketComparison', () => {
  it('compares fair match probability against market prices', () => {
    const comparison = buildFairMarketComparison({
      pFair,
      marketState: {
        eventTicker: 'KXATP-123',
        marketTicker: 'KXATP-123-A',
        marketTitle: 'Will Medvedev beat Berrettini?',
        marketStatus: 'OPEN',
        prices: {
          yesBid: 57,
          yesAsk: 59,
          noBid: 41,
          noAsk: 43,
          lastPrice: 58,
        },
        liquidity: {
          volume: 150000,
        },
        timestamps: {
          marketTimestamp: '2026-04-14T05:00:00Z',
        },
      },
    })

    expect(comparison.available).toBe(true)
    expect(comparison.marketYesSide).toBe('teamA')
    expect(comparison.marketProbA.mid).toBeCloseTo(0.58, 6)
    expect(comparison.edgeA.vsMid).toBeCloseTo(0.03, 6)
    expect(comparison.edgeB.vsLast).toBeCloseTo(-0.03, 6)
  })

  it('maps YES prices to teamB when the market ticker suffix matches teamB', () => {
    const comparison = buildFairMarketComparison({
      pFair,
      matchState: makeMatchState(),
      marketState: {
        eventTicker: 'KXATPCHALLENGERMATCH-26APR21ANTKRU',
        marketTicker: 'KXATPCHALLENGERMATCH-26APR21ANTKRU-KRU',
        marketTitle: 'Antonius vs Krueger',
        marketStatus: 'OPEN',
        prices: {
          yesBid: 67,
          yesAsk: 69,
          noBid: 31,
          noAsk: 33,
          lastPrice: 68,
        },
        liquidity: {
          volume: 150000,
        },
        timestamps: {
          marketTimestamp: '2026-04-21T18:00:00Z',
        },
      },
    })

    expect(comparison.available).toBe(true)
    expect(comparison.marketYesSide).toBe('teamB')
    expect(comparison.marketProbA.mid).toBeCloseTo(0.32, 6)
    expect(comparison.marketProbA.last).toBeCloseTo(0.32, 6)
    expect(comparison.marketProbB.mid).toBeCloseTo(0.68, 6)
    expect(comparison.edgeA.vsLast).toBeCloseTo(0.29, 6)
  })

  it('stays unavailable when market state is missing', () => {
    const comparison = buildFairMarketComparison({
      pFair: {
        version: 'p-fair/v1',
        point: { serverSide: null, pPointA: null, pPointB: null, source: 'none' },
        game: { serverSide: null, pGameA: null, pGameB: null, pHoldServer: null, pBreakReceiver: null, source: 'none' },
        set: { pSetA: null, pSetB: null, source: 'none' },
        match: { pMatchA: null, pMatchB: null, source: 'none' },
        anchor: {
          prematchFairProbA: null,
          prematchFairProbB: null,
          holdBaselineA: null,
          holdBaselineB: null,
          breakBaselineA: null,
          breakBaselineB: null,
        },
        diagnostics: {
          setIndex: null,
          isTiebreak: false,
          pointScoreA: null,
          pointScoreB: null,
          gameScoreA: null,
          gameScoreB: null,
          riskRule: null,
          integrity: null,
          statsAdjustmentA: null,
          statsAdjustmentB: null,
        },
      },
      marketState: null,
    })

    expect(comparison.available).toBe(false)
    expect(comparison.marketTicker).toBeNull()
    expect(comparison.edgeA.vsMid).toBeNull()
  })
})
