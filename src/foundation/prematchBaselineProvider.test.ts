import { describe, expect, it, vi } from 'vitest'

import { MemoryBaselineCache } from './baselineCache.js'
import { buildPrematchBaselineFromProviders } from './prematchBaselineProvider.js'
import type { CanonicalMatchState } from './canonicalMatchState.js'
import type { PlayerDirectoryEntry } from './playerMapping.js'

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
      teamA: {
        name: 'Jannik Sinner',
        shortName: 'Sinner J.',
        code: 'SIN',
        slug: 'jannik-sinner',
        playerId: 'flash-a',
      },
      teamB: {
        name: 'Carlos Alcaraz',
        shortName: 'Alcaraz C.',
        code: 'ALC',
        slug: 'carlos-alcaraz',
        playerId: 'flash-b',
      },
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

describe('buildPrematchBaselineFromProviders', () => {
  it('uses player mappings to fetch ATP baselines for both players', async () => {
    const directory: PlayerDirectoryEntry[] = [
      {
        source: 'atp',
        sourcePlayerId: 'S0AG',
        flashscorePlayerId: 'flash-a',
        fullName: 'Jannik Sinner',
      },
      {
        source: 'atp',
        sourcePlayerId: 'A0E2',
        flashscorePlayerId: 'flash-b',
        fullName: 'Carlos Alcaraz',
      },
    ]

    const getPlayerBaseline = vi
      .fn()
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce({
        source: 'atp',
        playerId: 'A0E2',
        firstName: 'Carlos',
        lastName: 'Alcaraz',
        nationality: 'Spain',
        age: 22,
        plays: 'Right-Handed',
        turnedPro: 2018,
        heightCm: 183,
        statYearFrom: 2019,
        statYearTo: 2026,
        category: 'Career',
        surface: 'ALL',
        rankDate: '2026-04-13T00:00:00',
        serve: {
          aces: 1584,
          doubleFaults: 650,
          firstServePercentage: 64,
          firstServePointsWonPercentage: 72,
          secondServePointsWonPercentage: 55,
          breakPointsFaced: 2100,
          breakPointsSavedPercentage: 66,
          serviceGamesPlayed: 4800,
          serviceGamesWonPercentage: 85,
          totalServicePointsWonPercentage: 67,
        },
        return: {
          firstServeReturnPointsWonPercentage: 34,
          secondServeReturnPointsWonPercentage: 55,
          breakPointsOpportunities: 3200,
          breakPointsConvertedPercentage: 42,
          returnGamesPlayed: 5000,
          returnGamesWonPercentage: 30,
          returnPointsWonPercentage: 42,
          totalPointsWonPercentage: 55,
        },
      })

    const result = await buildPrematchBaselineFromProviders(
      {
        matchState: makeState(),
        surface: 'clay',
      },
      {
        directory,
        atpClient: { getPlayerBaseline },
      },
    )

    expect(getPlayerBaseline).toHaveBeenNthCalledWith(1, 'S0AG', { year: 'all', surface: 'all' })
    expect(getPlayerBaseline).toHaveBeenNthCalledWith(2, 'A0E2', { year: 'all', surface: 'all' })
    expect(result.mappings.teamA?.sourcePlayerId).toBe('S0AG')
    expect(result.prematchBaseline.source).toBe('tour_official')
    expect(result.prematchBaseline.complete).toBe(true)
    expect(result.prematchBaseline.holdBaselineA).toBe(0.87)
    expect(result.prematchBaseline.holdBaselineB).toBe(0.85)
  })

  it('uses ITF mappings and client for ITF matches', async () => {
    const state = makeState({
      competition: {
        ...makeState().competition,
        tournamentName: 'ITF Men Tallahassee',
        tournamentLabel: 'ITF Men Tallahassee',
        tourType: 'ITF',
      },
      participants: {
        teamA: {
          name: 'Lilli Tagger',
          shortName: 'Tagger L.',
          code: 'TAG',
          slug: 'lilli-tagger',
          playerId: 'flash-itf-a',
        },
        teamB: {
          name: 'Mingge Xu',
          shortName: 'Xu M.',
          code: 'XU',
          slug: 'mingge-xu',
          playerId: 'flash-itf-b',
        },
      },
    })

    const directory: PlayerDirectoryEntry[] = [
      {
        source: 'itf',
        sourcePlayerId: '800564568',
        flashscorePlayerId: 'flash-itf-a',
        fullName: 'Lilli Tagger',
        meta: { circuitCode: 'WT', matchTypeCode: 'S' },
      },
      {
        source: 'itf',
        sourcePlayerId: '800553188',
        flashscorePlayerId: 'flash-itf-b',
        fullName: 'Mingge Xu',
        meta: { circuitCode: 'WT', matchTypeCode: 'S' },
      },
    ]

    const getPlayerBaseline = vi
      .fn()
      .mockResolvedValueOnce({
        source: 'itf',
        playerId: '800564568',
        firstName: 'Lilli',
        lastName: 'Tagger',
        fullName: 'Lilli Tagger',
        nationality: 'AUT',
        age: 18,
        dateOfBirth: '2007-02-11',
        currentSinglesRank: 422,
        currentDoublesRank: null,
        currentCombinedRank: null,
        currentWtnRank: 50,
        plays: 'Right-handed',
        height: null,
        overview: {
          overallWon: 24,
          overallLost: 9,
          overallWinPercentage: 72.7,
          hardWinPercentage: 68,
          clayWinPercentage: 74,
          grassWinPercentage: null,
        },
        serve: {
          aces: null,
          doubleFaults: null,
          firstServePercentage: null,
          firstServePointsWonPercentage: null,
          secondServePointsWonPercentage: null,
          breakPointsSavedPercentage: null,
          servicePointsWonPercentage: null,
          serviceGamesPlayed: null,
          serviceGamesWonPercentage: null,
        },
        return: {
          firstServeReturnPointsWonPercentage: null,
          secondServeReturnPointsWonPercentage: null,
          breakPointsConvertedPercentage: null,
          returnGamesPlayed: null,
          returnGamesWonPercentage: null,
          returnPointsWonPercentage: null,
        },
      })
      .mockResolvedValueOnce({
        source: 'itf',
        playerId: '800553188',
        firstName: 'Mingge',
        lastName: 'Xu',
        fullName: 'Mingge Xu',
        nationality: 'GBR',
        age: 17,
        dateOfBirth: '2008-01-02',
        currentSinglesRank: 515,
        currentDoublesRank: null,
        currentCombinedRank: null,
        currentWtnRank: 63,
        plays: 'Right-handed',
        height: null,
        overview: {
          overallWon: 19,
          overallLost: 14,
          overallWinPercentage: 57.6,
          hardWinPercentage: 61,
          clayWinPercentage: 50,
          grassWinPercentage: null,
        },
        serve: {
          aces: null,
          doubleFaults: null,
          firstServePercentage: null,
          firstServePointsWonPercentage: null,
          secondServePointsWonPercentage: null,
          breakPointsSavedPercentage: null,
          servicePointsWonPercentage: null,
          serviceGamesPlayed: null,
          serviceGamesWonPercentage: null,
        },
        return: {
          firstServeReturnPointsWonPercentage: null,
          secondServeReturnPointsWonPercentage: null,
          breakPointsConvertedPercentage: null,
          returnGamesPlayed: null,
          returnGamesWonPercentage: null,
          returnPointsWonPercentage: null,
        },
      })

    const result = await buildPrematchBaselineFromProviders(
      {
        matchState: state,
        surface: 'clay',
      },
      {
        directory,
        itfClient: { getPlayerBaseline },
      },
    )

    expect(getPlayerBaseline).toHaveBeenNthCalledWith(1, '800564568', {
      circuitCode: 'WT',
      matchTypeCode: 'S',
    })
    expect(getPlayerBaseline).toHaveBeenNthCalledWith(2, '800553188', {
      circuitCode: 'WT',
      matchTypeCode: 'S',
    })
    expect(result.mappings.preferredSource).toBe('itf')
    expect(result.prematchBaseline.source).toBe('tour_official')
    expect(result.prematchBaseline.complete).toBe(false)
    expect(result.prematchBaseline.tourType).toBe('ITF')
  })

  it('passes market implied probabilities through to the prematch baseline', async () => {
    const result = await buildPrematchBaselineFromProviders(
      {
        matchState: makeState(),
        marketImpliedProbA: 0.58,
        marketImpliedProbB: 0.47,
      },
      {
        directory: [],
      },
    )

    expect(result.playerA).toBeNull()
    expect(result.playerB).toBeNull()
    expect(result.prematchBaseline.source).toBe('market')
    expect(result.prematchBaseline.prematchFairProbA).toBeCloseTo(0.5523, 3)
    expect(result.prematchBaseline.prematchFairProbB).toBeCloseTo(0.4476, 3)
  })

  it('reuses cached ATP baselines instead of fetching them again', async () => {
    const directory: PlayerDirectoryEntry[] = [
      {
        source: 'atp',
        sourcePlayerId: 'S0AG',
        flashscorePlayerId: 'flash-a',
        fullName: 'Jannik Sinner',
      },
      {
        source: 'atp',
        sourcePlayerId: 'A0E2',
        flashscorePlayerId: 'flash-b',
        fullName: 'Carlos Alcaraz',
      },
    ]

    const cache = new MemoryBaselineCache()
    cache.set({
      key: { source: 'atp', sourcePlayerId: 'S0AG', year: 'all', surface: 'all' },
      fetchedAt: '2026-04-16T00:00:00Z',
      baseline: {
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
        rankDate: '2026-04-13T00:00:00Z',
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
    })

    const getPlayerBaseline = vi.fn().mockResolvedValue({
      source: 'atp',
      playerId: 'A0E2',
      firstName: 'Carlos',
      lastName: 'Alcaraz',
      nationality: 'Spain',
      age: 22,
      plays: 'Right-Handed',
      turnedPro: 2018,
      heightCm: 183,
      statYearFrom: 2019,
      statYearTo: 2026,
      category: 'Career',
      surface: 'ALL',
      rankDate: '2026-04-13T00:00:00Z',
      serve: {
        aces: 1584,
        doubleFaults: 650,
        firstServePercentage: 64,
        firstServePointsWonPercentage: 72,
        secondServePointsWonPercentage: 55,
        breakPointsFaced: 2100,
        breakPointsSavedPercentage: 66,
        serviceGamesPlayed: 4800,
        serviceGamesWonPercentage: 85,
        totalServicePointsWonPercentage: 67,
      },
      return: {
        firstServeReturnPointsWonPercentage: 34,
        secondServeReturnPointsWonPercentage: 55,
        breakPointsOpportunities: 3200,
        breakPointsConvertedPercentage: 42,
        returnGamesPlayed: 5000,
        returnGamesWonPercentage: 30,
        returnPointsWonPercentage: 42,
        totalPointsWonPercentage: 55,
      },
    })

    const result = await buildPrematchBaselineFromProviders(
      {
        matchState: makeState(),
        surface: 'clay',
      },
      {
        directory,
        atpClient: { getPlayerBaseline },
        baselineCache: cache,
      },
    )

    expect(getPlayerBaseline).toHaveBeenCalledTimes(1)
    expect(result.playerA?.playerId).toBe('S0AG')
    expect(result.playerB?.playerId).toBe('A0E2')
  })
})
