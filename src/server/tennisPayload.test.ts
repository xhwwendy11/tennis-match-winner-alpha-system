import { describe, expect, it } from 'vitest'

import { mapServerPayloadToTennisFeedMatch } from './tennisPayload.js'

describe('mapServerPayloadToTennisFeedMatch', () => {
  it('maps a minimal server payload into the internal tennis feed shape', () => {
    const result = mapServerPayloadToTennisFeedMatch({
      matchId: 'match-1',
      matchUrl: 'https://www.flashscore.com/match/tennis/example',
      pA: 0.68,
      pB: 0.64,
      tournamentName: 'ATP Test Event',
      tournamentLabel: 'ATP - Singles',
      round: 'Quarter-finals',
      status: 'LIVE',
      teamA: { name: 'Player A', score: 1 },
      teamB: { name: 'Player B', score: 0 },
      currentSet: { label: 'Set 2', teamAScore: 3, teamBScore: 2 },
      currentGame: { teamAScore: '30', teamBScore: '15' },
      serverSide: 'teamA',
      stats: {
        pointsWonA: 42,
        pointsWonB: 35,
        breakPointsSavedA: '3/5',
      },
    })

    expect(result.eventId).toBe('match-1')
    expect(result.teamA.name).toBe('Player A')
    expect(result.currentSet).toEqual({
      label: 'Set 2',
      teamAScore: '3',
      teamBScore: '2',
    })
    expect(result.currentGame).toEqual({
      teamAScore: '30',
      teamBScore: '15',
    })
    expect(result.serverSideResolved).toBe('teamA')
    expect(result.stats?.pointsWonA).toBe(42)
    expect(result.stats?.breakPointsSavedA).toBe('3/5')
  })
})
