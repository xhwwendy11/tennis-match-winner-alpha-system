import { describe, expect, it } from 'vitest'

import { toLookupMatch } from './mapper.js'
import type { TennisFeedMatch } from './types.js'

function buildMatch(overrides: Partial<TennisFeedMatch> = {}): TennisFeedMatch {
  const base: TennisFeedMatch = {
    eventId: 'event-1',
    tournamentName: 'Bucharest',
    tournamentPath: 'https://www.flashscore.com/tennis/atp-singles/bucharest/',
    tournamentLabel: 'ATP - SINGLES',
    round: 'Quarter-finals',
    startTimeISO: '2026-04-03T16:00:00.000Z',
    status: 'LIVE',
    statusText: 'Live',
    teamA: {
      name: 'Titouan Droguet',
      shortName: 'Droguet T.',
      code: 'DRO',
      slug: 'droguet-t',
      playerId: 'A57Xet1f',
      score: 1,
    },
    teamB: {
      name: 'Daniel Merida Aguilar',
      shortName: 'Merida Aguilar D.',
      code: 'MER',
      slug: 'daniel-m-a',
      playerId: 'WOtXbAu5',
      score: 0,
    },
    currentSet: { label: 'Set 2', teamAScore: '2', teamBScore: '2' },
    currentGame: { teamAScore: '15', teamBScore: '15' },
    serverSide: 'teamA',
    serverSideResolved: 'teamA',
    serverSideSource: 'dom',
    serveConfidence: 'high',
    serverPlayerName: 'Droguet T.',
    stats: null,
    sets: [{ label: 'Set 1', teamAScore: '6', teamBScore: '3' }],
    matchUrl: 'https://www.flashscore.com/match/tennis/foo/bar/',
    sourcePageUrl: 'https://www.flashscore.com/match/tennis/foo/bar/?mid=abc',
  }

  const match = {
    ...base,
    ...overrides,
  }

  if (
    overrides.serverSideResolved !== undefined ||
    overrides.serverSideSource !== undefined ||
    overrides.serveConfidence !== undefined
  ) {
    return match
  }

  if (match.serverSide) {
    return {
      ...match,
      serverSideResolved: match.serverSide,
      serverSideSource: 'dom',
      serveConfidence: 'high',
    }
  }

  return {
    ...match,
    serverSideResolved: null,
    serverSideSource: 'unknown',
    serveConfidence: 'low',
  }
}

describe('toLookupMatch', () => {
  it('keeps server resolution metadata in the lookup payload', () => {
    const lookup = toLookupMatch(buildMatch())

    expect(lookup.serverSide).toBe('teamA')
    expect(lookup.serverSideResolved).toBe('teamA')
    expect(lookup.serverSideSource).toBe('dom')
    expect(lookup.serveConfidence).toBe('high')
    expect(lookup.serverPlayerName).toBe('Droguet T.')
  })

  it('preserves unresolved server metadata when serve extraction fails', () => {
    const lookup = toLookupMatch(
      buildMatch({
        serverSide: null,
        serverSideResolved: null,
        serverSideSource: 'unknown',
        serveConfidence: 'low',
        serverPlayerName: null,
      }),
    )

    expect(lookup.serverSide).toBeNull()
    expect(lookup.serverSideResolved).toBeNull()
    expect(lookup.serverSideSource).toBe('unknown')
    expect(lookup.serveConfidence).toBe('low')
    expect(lookup.serverPlayerName).toBeNull()
  })

  it('keeps retry-resolved serving side separately from raw serverSide', () => {
    const lookup = toLookupMatch(
      buildMatch({
        serverSide: null,
        serverSideResolved: 'teamB',
        serverSideSource: 'retry',
        serveConfidence: 'high',
        serverPlayerName: 'Merida Aguilar D.',
      }),
    )

    expect(lookup.serverSide).toBeNull()
    expect(lookup.serverSideResolved).toBe('teamB')
    expect(lookup.serverSideSource).toBe('retry')
    expect(lookup.serveConfidence).toBe('high')
    expect(lookup.serverPlayerName).toBe('Merida Aguilar D.')
  })
})
