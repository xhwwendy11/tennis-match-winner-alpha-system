import { describe, expect, it, vi } from 'vitest'

import { resolvePlayerDirectoryMappings } from './playerDirectoryResolver.js'
import type { CanonicalMatchState } from './canonicalMatchState.js'
import type { PlayerDirectoryEntry } from './playerMapping.js'

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
    status: { matchStatus: 'PRE', statusText: 'Scheduled', abnormalReason: 'none' },
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
    serve: { raw: null, resolved: null, source: 'unknown', confidence: 'low', syncState: 'unknown' },
    quality: { matchIntegrity: 'ok' },
    stats: null,
    timestamps: { ingestedAt: '2026-04-13T00:00:00Z', scoreTimestamp: null, serveTimestamp: null, statsTimestamp: null },
  }
}

describe('resolvePlayerDirectoryMappings', () => {
  it('returns existing mappings from the local directory without discovery', async () => {
    const directory: PlayerDirectoryEntry[] = [
      { source: 'atp', sourcePlayerId: 'S0AG', flashscorePlayerId: 'flash-a', fullName: 'Jannik Sinner' },
      { source: 'atp', sourcePlayerId: 'A0E2', flashscorePlayerId: 'flash-b', fullName: 'Carlos Alcaraz' },
    ]

    const result = await resolvePlayerDirectoryMappings(makeState(), { directory })

    expect(result.mappings.teamA?.sourcePlayerId).toBe('S0AG')
    expect(result.discoveredEntries).toEqual([])
  })

  it('discovers missing ATP mappings and persists them through the callback', async () => {
    const persistDiscoveredEntries = vi.fn()
    const findPlayerByExactName = vi
      .fn()
      .mockResolvedValueOnce({ rank: 1, name: 'Jannik Sinner', country: 'Italy', countryCode: 'ITA', playerId: 'S0AG', profileUrl: null })
      .mockResolvedValueOnce({ rank: 2, name: 'Carlos Alcaraz', country: 'Spain', countryCode: 'ESP', playerId: 'A0E2', profileUrl: null })

    const result = await resolvePlayerDirectoryMappings(makeState(), {
      directory: [],
      atpDirectoryClient: { findPlayerByExactName },
      persistDiscoveredEntries,
    })

    expect(findPlayerByExactName).toHaveBeenNthCalledWith(1, 'Jannik Sinner')
    expect(findPlayerByExactName).toHaveBeenNthCalledWith(2, 'Carlos Alcaraz')
    expect(result.mappings.teamA?.sourcePlayerId).toBe('S0AG')
    expect(result.mappings.teamB?.sourcePlayerId).toBe('A0E2')
    expect(result.discoveredEntries).toHaveLength(2)
    expect(persistDiscoveredEntries).toHaveBeenCalledTimes(1)
  })

  it('supports WTA discovery through the same resolver boundary', async () => {
    const state = makeState()
    state.competition.tourType = 'WTA'
    state.participants.teamA.name = 'Iga Swiatek'
    state.participants.teamB.name = 'Aryna Sabalenka'
    state.participants.teamA.playerId = 'wta-a'
    state.participants.teamB.playerId = 'wta-b'

    const findPlayerByExactName = vi
      .fn()
      .mockResolvedValueOnce({ playerId: '326408', name: 'Iga Swiatek', profileUrl: '/players/326408/iga-swiatek' })
      .mockResolvedValueOnce({ playerId: '319166', name: 'Aryna Sabalenka', profileUrl: '/players/319166/aryna-sabalenka' })

    const result = await resolvePlayerDirectoryMappings(state, {
      directory: [],
      wtaDirectoryClient: { findPlayerByExactName },
    })

    expect(result.mappings.teamA?.source).toBe('wta')
    expect(result.mappings.teamA?.sourcePlayerId).toBe('326408')
    expect(result.mappings.teamB?.sourcePlayerId).toBe('319166')
  })

  it('supports ITF discovery with source meta', async () => {
    const state = makeState()
    state.competition.tourType = 'ITF'
    state.participants.teamA.name = 'Lilli Tagger'
    state.participants.teamB.name = 'Mingge Xu'
    state.participants.teamA.playerId = 'itf-a'
    state.participants.teamB.playerId = 'itf-b'

    const findPlayerByExactName = vi
      .fn()
      .mockResolvedValueOnce({
        playerId: '800564568',
        name: 'Lilli Tagger',
        meta: { circuitCode: 'WT', matchTypeCode: 'S' },
      })
      .mockResolvedValueOnce({
        playerId: '800553188',
        name: 'Mingge Xu',
        meta: { circuitCode: 'WT', matchTypeCode: 'S' },
      })

    const result = await resolvePlayerDirectoryMappings(state, {
      directory: [],
      itfDirectoryClient: { findPlayerByExactName },
    })

    expect(result.mappings.teamA?.source).toBe('itf')
    expect(result.mappings.teamA?.meta?.circuitCode).toBe('WT')
    expect(result.mappings.teamB?.sourcePlayerId).toBe('800553188')
  })
})
