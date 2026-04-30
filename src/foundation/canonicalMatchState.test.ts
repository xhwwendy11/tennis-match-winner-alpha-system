import { describe, expect, it } from 'vitest'

import { buildCanonicalMatchState } from './canonicalMatchState.js'
import type { TennisFeedMatch } from '../realtime-score/tennis/types.js'

function makeMatch(overrides: Partial<TennisFeedMatch> = {}): TennisFeedMatch {
  return {
    eventId: 'evt-1',
    tournamentName: 'ATP Monte Carlo',
    tournamentPath: '/tennis/atp-singles/monte-carlo',
    tournamentLabel: 'ATP Monte Carlo',
    round: 'Round of 32',
    startTimeISO: '2026-04-11T18:00:00Z',
    status: 'LIVE',
    statusText: 'Live',
    teamA: {
      name: 'Daniil Medvedev',
      shortName: 'Medvedev',
      code: 'MED',
      slug: 'daniil-medvedev',
      playerId: 'a1',
      score: 0,
    },
    teamB: {
      name: 'Matteo Berrettini',
      shortName: 'Berrettini',
      code: 'BER',
      slug: 'matteo-berrettini',
      playerId: 'b1',
      score: 1,
    },
    currentSet: {
      label: 'Set 2',
      teamAScore: '0',
      teamBScore: '2',
    },
    currentGame: {
      teamAScore: '0',
      teamBScore: '0',
    },
    serverSide: 'teamB',
    serverSideResolved: 'teamB',
    serverSideSource: 'dom',
    serveConfidence: 'high',
    serverPlayerName: 'Matteo Berrettini',
    stats: null,
    sets: [
      {
        label: 'Set 1',
        teamAScore: '6',
        teamBScore: '7',
      },
      {
        label: 'Set 2',
        teamAScore: '0',
        teamBScore: '2',
      },
    ],
    matchUrl: 'https://www.flashscore.com/match/tennis/example',
    sourcePageUrl: 'https://www.flashscore.com/match/tennis/example',
    ...overrides,
  }
}

describe('buildCanonicalMatchState', () => {
  it('builds a richer layer-1 state object from a live flashscore match', () => {
    const state = buildCanonicalMatchState(
      makeMatch({
        stats: {
          acesA: 2,
          acesB: 1,
          doubleFaultsA: 2,
          doubleFaultsB: 0,
          firstServePercentageA: '65%',
          firstServePercentageB: '87%',
          firstServeWonA: '69% (36/52)',
          firstServeWonB: '66% (56/85)',
          secondServeWonA: '54% (15/28)',
          secondServeWonB: '31% (4/13)',
          servicePointsWonA: '64% (51/80)',
          servicePointsWonB: '61% (60/98)',
          firstServeReturnPointsWonA: '34% (29/85)',
          firstServeReturnPointsWonB: '31% (16/52)',
          secondServeReturnPointsWonA: '69% (9/13)',
          secondServeReturnPointsWonB: '46% (13/28)',
          returnPointsWonA: '41% (38/93)',
          returnPointsWonB: '35% (29/80)',
          breakPointsSavedA: '3/5',
          breakPointsSavedB: '9/10',
          breakPointsConvertedA: '1/10',
          breakPointsConvertedB: '2/10',
          serviceGamesPlayedA: '8/10',
          serviceGamesPlayedB: '9/10',
          returnGamesPlayedA: '1/10',
          returnGamesPlayedB: '2/10',
          returnGamesWonA: '11% (1/9)',
          returnGamesWonB: '20% (2/10)',
          pointsWonA: 57,
          pointsWonB: 79,
          serviceGamesWonA: 8,
          serviceGamesWonB: 9,
          breakPointsDisplayA: '1/10',
          breakPointsDisplayB: '2/10',
        },
      }),
    )

    expect(state).not.toBeNull()
    expect(state?.source.sourceKind).toBe('flashscore')
    expect(state?.competition.tourType).toBe('ATP')
    expect(state?.competition.bestOf).toBe(3)
    expect(state?.participants.teamA.name).toBe('Daniil Medvedev')
    expect(state?.scoreboard.setIndex).toBe(2)
    expect(state?.serve.syncState).toBe('synced')
    expect(state?.quality.matchIntegrity).toBe('ok')
    expect(state?.stats.acesA).toBe(2)
    expect(state?.stats.firstServePercentageB).toBe('87%')
    expect(state?.stats.pointsWonA).toBe(57)
    expect(state?.stats.firstServeWonB).toBe('66% (56/85)')
    expect(state?.stats.returnPointsWonA).toBe('41% (38/93)')
    expect(state?.stats.firstServeReturnPointsWonB).toBe('31% (16/52)')
    expect(state?.stats.breakPointsConvertedB).toBe('2/10')
    expect(state?.stats.breakPointsDisplayB).toBe('2/10')
    expect(state?.stats.doubleFaultsA).toBe(2)
    expect(state?.timestamps.ingestedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(state?.timestamps.scoreTimestamp).toBe(state?.timestamps.ingestedAt)
    expect(state?.timestamps.serveTimestamp).toBe(state?.timestamps.ingestedAt)
    expect(state?.timestamps.statsTimestamp).toBe(state?.timestamps.ingestedAt)
  })

  it('marks incomplete live score and missing serve as degraded quality', () => {
    const state = buildCanonicalMatchState(
      makeMatch({
        currentSet: null,
        currentGame: null,
        serverSide: null,
        serverSideResolved: null,
        serverSideSource: 'unknown',
        serveConfidence: 'low',
      }),
    )

    expect(state?.status.abnormalReason).toBe('incomplete')
    expect(state?.quality.matchIntegrity).toBe('score_incomplete')
    expect(state?.serve.syncState).toBe('unknown')
    expect(state?.timestamps.scoreTimestamp).toBeNull()
    expect(state?.timestamps.serveTimestamp).toBeNull()
  })

  it('classifies ITF tournaments as ITF tour type', () => {
    const state = buildCanonicalMatchState(
      makeMatch({
        tournamentName: 'ITF Men Tallahassee',
        tournamentLabel: 'ITF Men Tallahassee',
      }),
    )

    expect(state?.competition.tourType).toBe('ITF')
  })

  it('classifies challenger events from flashscore path metadata', () => {
    const state = buildCanonicalMatchState(
      makeMatch({
        tournamentName: 'Tallahassee',
        tournamentLabel: 'Tallahassee',
        tournamentPath: 'https://www.flashscore.com/tennis/challenger-men-singles/tallahassee/',
        sourcePageUrl: 'https://www.flashscore.com/tennis/challenger-men-singles/tallahassee/',
      }),
    )

    expect(state?.competition.tourType).toBe('ATP_CHALLENGER')
  })

  it('classifies WTA 125 events as WTA', () => {
    const state = buildCanonicalMatchState(
      makeMatch({
        tournamentName: 'WTA 125 Saint-Malo',
        tournamentLabel: 'WTA 125 Saint-Malo',
        tournamentPath: 'https://www.flashscore.com/tennis/challenger-women-singles/saint-malo/',
        sourcePageUrl: 'https://www.flashscore.com/tennis/challenger-women-singles/saint-malo/',
      }),
    )

    expect(state?.competition.tourType).toBe('WTA')
  })

  it('classifies ITF W35 style tournament names as ITF', () => {
    const state = buildCanonicalMatchState(
      makeMatch({
        tournamentName: 'W35 Zephyrhills',
        tournamentLabel: 'W35 Zephyrhills',
        tournamentPath: 'https://www.flashscore.com/tennis/itf-women/zephyrhills/',
        sourcePageUrl: 'https://www.flashscore.com/tennis/itf-women/zephyrhills/',
      }),
    )

    expect(state?.competition.tourType).toBe('ITF')
  })

  it('marks doubles matches as unsupported doubles', () => {
    const state = buildCanonicalMatchState(
      makeMatch({
        tournamentName: 'Challenger Men Doubles',
        tournamentLabel: 'Challenger Men - Doubles',
        tournamentPath: 'https://www.flashscore.com/tennis/challenger-men-doubles/savannah/',
        teamA: {
          name: 'Player A/Player B',
          shortName: 'A/B',
          code: 'AB',
          slug: 'player-a',
          playerId: 'a1/b1',
          score: 0,
        },
      }),
    )

    expect(state?.competition.discipline).toBe('doubles')
    expect(state?.quality.matchIntegrity).toBe('unsupported_doubles')
  })
})
