import { describe, expect, it } from 'vitest'

import { buildPrematchBaseline } from './prematchBaselineBuilder.js'
import type { CanonicalMatchState } from './canonicalMatchState.js'

function makeState(overrides: Partial<CanonicalMatchState> = {}): CanonicalMatchState {
  return {
    matchId: 'evt-1',
    source: {
      sourceKind: 'flashscore',
      matchUrl: 'https://www.flashscore.com/match/tennis/example',
      sourcePageUrl: 'https://www.flashscore.com/match/tennis/example',
    },
    competition: {
      tournamentName: 'ATP Monte Carlo',
      tournamentLabel: 'ATP Monte Carlo',
      tournamentPath: '/tennis/atp-singles/monte-carlo',
      round: 'Round of 32',
      bestOf: 3,
      tourType: 'ATP',
      gender: 'men',
      startTimeISO: '2026-04-11T18:00:00Z',
    },
    participants: {
      teamA: { name: 'A', shortName: 'A', code: 'A', slug: 'a', playerId: 'a1' },
      teamB: { name: 'B', shortName: 'B', code: 'B', slug: 'b', playerId: 'b1' },
    },
    status: {
      matchStatus: 'PRE',
      statusText: 'Scheduled',
      abnormalReason: 'none',
    },
    scoreboard: {
      setIndex: null,
      setsWonA: 0,
      setsWonB: 0,
      currentSetGamesA: null,
      currentSetGamesB: null,
      currentGamePointsA: null,
      currentGamePointsB: null,
      isTiebreak: false,
    },
    serve: {
      raw: null,
      resolved: null,
      source: 'unknown',
      confidence: 'low',
      syncState: 'unknown',
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
      serviceGamesWonA: null,
      serviceGamesWonB: null,
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
      ingestedAt: '2026-04-13T00:00:00Z',
      scoreTimestamp: null,
      serveTimestamp: null,
      statsTimestamp: null,
    },
    ...overrides,
  }
}

describe('buildPrematchBaseline', () => {
  it('builds a complete prematch baseline from ATP/WTA player baselines', () => {
    const baseline = buildPrematchBaseline({
      matchState: makeState(),
      playerA: {
        source: 'atp',
        playerId: 'S0AG',
        firstName: 'Jannik',
        lastName: 'Sinner',
        nationality: 'Italy',
        age: 24,
        plays: 'Right-Handed',
        turnedPro: 2018,
        heightCm: 191,
        statYearFrom: 2019,
        statYearTo: 2026,
        category: 'Career',
        surface: 'ALL',
        rankDate: '2026-04-13T00:00:00',
        serve: {
          aces: 2555,
          doubleFaults: 818,
          firstServePercentage: 60,
          firstServePointsWonPercentage: 76,
          secondServePointsWonPercentage: 56,
          breakPointsFaced: 2167,
          breakPointsSavedPercentage: 68,
          serviceGamesPlayed: 5212,
          serviceGamesWonPercentage: 87,
          totalServicePointsWonPercentage: 68,
        },
        return: {
          firstServeReturnPointsWonPercentage: 32,
          secondServeReturnPointsWonPercentage: 54,
          breakPointsOpportunities: 3406,
          breakPointsConvertedPercentage: 43,
          returnGamesPlayed: 5135,
          returnGamesWonPercentage: 28,
          returnPointsWonPercentage: 41,
          totalPointsWonPercentage: 54,
        },
      },
      playerB: {
        source: 'wta',
        playerId: '326408',
        firstName: 'Iga',
        lastName: 'Swiatek',
        countryCode: 'POL',
        dateOfBirth: '2001-05-31',
        turnedPro: 2016,
        plays: 'Right-Handed',
        currentSinglesRanking: 4,
        year: 2026,
        overview: {
          wonLost: '12 / 6',
          singlesTitles: 0,
          prizeMoney: '$1,261,285',
        },
        serve: {
          aces: 56,
          doubleFaults: 46,
          firstServePercentage: 62.2,
          firstServeWonPercentage: 67,
          secondServeWonPercentage: 50.9,
          breakPointsSavedPercentage: 60.2,
          servicePointsWonPercentage: 60.9,
          serviceGamesWonPercentage: 71.7,
          serviceGamesPlayed: 187,
        },
        return: {
          returnPointsWonPercentage: 47.4,
          firstReturnPointsWonPercentage: 39.7,
          secondReturnPointsWonPercentage: 61.1,
          breakPointsConvertedPercentage: 51.3,
          returnGamesWonPercentage: 44.3,
          returnGamesPlayed: 183,
        },
      },
      surface: 'clay',
    })

    expect(baseline.source).toBe('tour_official')
    expect(baseline.complete).toBe(true)
    expect(baseline.surface).toBe('clay')
    expect(baseline.holdBaselineA).toBe(0.87)
    expect(baseline.holdBaselineB).toBeCloseTo(0.717, 6)
    expect(baseline.breakBaselineA).toBe(0.28)
    expect(baseline.breakBaselineB).toBeCloseTo(0.443, 6)
    expect(baseline.prematchFairProbA).toBeNull()
  })

  it('uses market implied probabilities when provided', () => {
    const baseline = buildPrematchBaseline({
      matchState: makeState(),
      playerA: null,
      playerB: null,
      marketImpliedProbA: 0.64,
      marketImpliedProbB: 0.41,
    })

    expect(baseline.source).toBe('market')
    expect(baseline.prematchFairProbA).toBeCloseTo(0.6095, 4)
    expect(baseline.prematchFairProbB).toBeCloseTo(0.3905, 4)
    expect(baseline.strengthBucketA).toBe('favorite')
    expect(baseline.strengthBucketB).toBe('underdog')
    expect(baseline.holdBaselineA).toBe(0.8)
    expect(baseline.breakBaselineB).toBe(0.2)
  })

  it('uses tour defaults when no ids or market anchor are available', () => {
    const state = makeState({
      competition: {
        ...makeState().competition,
        tourType: 'ATP_CHALLENGER',
      },
    })

    const baseline = buildPrematchBaseline({
      matchState: state,
      playerA: null,
      playerB: null,
    })

    expect(baseline.source).toBe('fallback')
    expect(baseline.complete).toBe(true)
    expect(baseline.prematchFairProbA).toBeNull()
    expect(baseline.prematchFairProbB).toBeNull()
    expect(baseline.holdBaselineA).toBe(0.77)
    expect(baseline.holdBaselineB).toBe(0.77)
    expect(baseline.breakBaselineA).toBe(0.23)
    expect(baseline.breakBaselineB).toBe(0.23)
  })

  it('does not treat zero-game official stats as a complete player baseline', () => {
    const state = makeState({
      competition: {
        ...makeState().competition,
        tourType: 'ATP_CHALLENGER',
      },
    })

    const baseline = buildPrematchBaseline({
      matchState: state,
      playerA: {
        source: 'atp',
        playerId: 'G0BY',
        firstName: 'Daniil',
        lastName: 'Glinka',
        nationality: null,
        age: null,
        plays: null,
        turnedPro: null,
        heightCm: null,
        statYearFrom: null,
        statYearTo: null,
        category: null,
        surface: null,
        rankDate: null,
        serve: {
          aces: 0,
          doubleFaults: 0,
          firstServePercentage: 0,
          firstServePointsWonPercentage: 0,
          secondServePointsWonPercentage: 0,
          breakPointsFaced: 0,
          breakPointsSavedPercentage: 0,
          serviceGamesPlayed: 0,
          serviceGamesWonPercentage: 0,
          totalServicePointsWonPercentage: 0,
        },
        return: {
          firstServeReturnPointsWonPercentage: 0,
          secondServeReturnPointsWonPercentage: 0,
          breakPointsOpportunities: 0,
          breakPointsConvertedPercentage: 0,
          returnGamesPlayed: 0,
          returnGamesWonPercentage: 0,
          returnPointsWonPercentage: 0,
          totalPointsWonPercentage: 0,
        },
      },
      playerB: null,
    })

    expect(baseline.source).toBe('tour_official')
    expect(baseline.complete).toBe(false)
    expect(baseline.holdBaselineA).toBe(0.77)
    expect(baseline.breakBaselineA).toBe(0.23)
  })
})
