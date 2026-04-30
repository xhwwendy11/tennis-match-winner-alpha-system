import { describe, expect, it } from 'vitest'

import { buildMatchPlayerMappings, type PlayerDirectoryEntry } from './playerMapping.js'
import type { CanonicalMatchState } from './canonicalMatchState.js'

function makeState(): CanonicalMatchState {
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
  }
}

describe('buildMatchPlayerMappings', () => {
  it('prefers source entries that match Flashscore player ids', () => {
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

    const mappings = buildMatchPlayerMappings(makeState(), directory)

    expect(mappings.preferredSource).toBe('atp')
    expect(mappings.teamA).toEqual({
      source: 'atp',
      sourcePlayerId: 'S0AG',
      matchedBy: 'flashscore_player_id',
      fullName: 'Jannik Sinner',
    })
    expect(mappings.teamB?.sourcePlayerId).toBe('A0E2')
  })

  it('falls back to aliases when ids and slugs are missing', () => {
    const state = makeState()
    state.participants.teamA.playerId = null
    state.participants.teamA.slug = null
    state.participants.teamA.name = 'Iga Swiatek'
    state.participants.teamA.shortName = 'Swiatek I.'
    state.participants.teamB.playerId = null
    state.participants.teamB.slug = null
    state.participants.teamB.name = 'Aryna Sabalenka'
    state.participants.teamB.shortName = 'Sabalenka A.'
    state.competition.tourType = 'WTA'

    const directory: PlayerDirectoryEntry[] = [
      {
        source: 'wta',
        sourcePlayerId: '326408',
        fullName: 'Iga Swiatek',
        aliases: ['Swiatek I.'],
      },
      {
        source: 'wta',
        sourcePlayerId: '320760',
        fullName: 'Aryna Sabalenka',
        aliases: ['Sabalenka A.'],
      },
    ]

    const mappings = buildMatchPlayerMappings(state, directory)

    expect(mappings.preferredSource).toBe('wta')
    expect(mappings.teamA?.matchedBy).toBe('full_name')
    expect(mappings.teamB?.matchedBy).toBe('full_name')
  })

  it('prefers ITF directory entries for ITF matches and preserves entry meta', () => {
    const state = makeState()
    state.competition.tourType = 'ITF'
    state.participants.teamA.name = 'Lilli Tagger'
    state.participants.teamA.shortName = 'Tagger L.'
    state.participants.teamA.playerId = 'flash-itf-a'
    state.participants.teamB.name = 'Mingge Xu'
    state.participants.teamB.shortName = 'Xu M.'
    state.participants.teamB.playerId = 'flash-itf-b'

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

    const mappings = buildMatchPlayerMappings(state, directory)

    expect(mappings.preferredSource).toBe('itf')
    expect(mappings.teamA?.source).toBe('itf')
    expect(mappings.teamA?.meta).toEqual({ circuitCode: 'WT', matchTypeCode: 'S' })
  })
})
