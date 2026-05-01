import { describe, expect, it } from 'vitest'

import type { PrematchBaseline } from '../foundation/prematchBaseline.js'
import { extractMatchFromServerPayload } from './extractMatchFromServerPayload.js'

describe('extractMatchFromServerPayload', () => {
  it('builds pFair from server-provided live state and stats', async () => {
    const baseline: PrematchBaseline = {
      source: 'tour_official',
      complete: true,
      bestOf: 3,
      surface: 'hard',
      tourType: 'ATP',
      prematchFairProbA: 0.58,
      prematchFairProbB: 0.42,
      strengthBucketA: 'balanced',
      strengthBucketB: 'balanced',
      holdBaselineA: 0.82,
      holdBaselineB: 0.78,
      breakBaselineA: 0.22,
      breakBaselineB: 0.18,
    }

    const result = await extractMatchFromServerPayload(
      {
        matchId: 'server-match-1',
        matchUrl: 'https://www.flashscore.com/match/tennis/example',
        sourcePageUrl: 'https://www.flashscore.com/match/tennis/example?mid=abc',
        tournamentName: 'ATP Test Event',
        tournamentLabel: 'ATP - Singles',
        round: 'Semi-finals',
        status: 'LIVE',
        teamA: { name: 'Player A', score: 1 },
        teamB: { name: 'Player B', score: 0 },
        currentSet: { label: 'Set 2', teamAScore: 4, teamBScore: 3 },
        currentGame: { teamAScore: '30', teamBScore: '15' },
        serverSide: 'teamA',
        serverSideResolved: 'teamA',
        serverSideSource: 'dom',
        serveConfidence: 'high',
        stats: {
          pointsWonA: 50,
          pointsWonB: 41,
          serviceGamesWonA: 5,
          serviceGamesWonB: 4,
          returnPointsWonA: '18/36',
          returnPointsWonB: '12/33',
          breakPointsSavedA: '3/4',
          breakPointsSavedB: '1/3',
        },
      },
      {
        prematchBaseline: baseline,
      },
    )

    expect(result.decisionSnapshot.match.matchId).toBe('server-match-1')
    expect(result.decisionSnapshot.match.serverSide).toBe('teamA')
    expect(result.probabilityState.pFair.match.pMatchA).not.toBeNull()
    expect(result.probabilityState.pFair.game.pGameA).not.toBeNull()
    expect(result.decisionSnapshot.quality.tier).toBe('high')
    expect(result.decisionSnapshot.pFair.match.pMatchA).toBe(result.probabilityState.pFair.match.pMatchA)
  })

  it('keeps working without live stats by falling back to score-state only input', async () => {
    const baseline: PrematchBaseline = {
      source: 'tour_official',
      complete: true,
      bestOf: 3,
      surface: 'hard',
      tourType: 'ATP',
      prematchFairProbA: 0.58,
      prematchFairProbB: 0.42,
      strengthBucketA: 'balanced',
      strengthBucketB: 'balanced',
      holdBaselineA: 0.82,
      holdBaselineB: 0.78,
      breakBaselineA: 0.22,
      breakBaselineB: 0.18,
    }

    const result = await extractMatchFromServerPayload(
      {
        matchId: 'server-match-2',
        matchUrl: 'https://www.flashscore.com/match/tennis/example',
        sourcePageUrl: 'https://www.flashscore.com/match/tennis/example?mid=abc',
        tournamentName: 'ATP Test Event',
        tournamentLabel: 'ATP - Singles',
        round: 'Semi-finals',
        status: 'LIVE',
        teamA: { name: 'Player A', score: 1 },
        teamB: { name: 'Player B', score: 0 },
        currentSet: { label: 'Set 2', teamAScore: 4, teamBScore: 3 },
        currentGame: { teamAScore: '30', teamBScore: '15' },
        serverSide: 'teamA',
        serverSideResolved: 'teamA',
        serverSideSource: 'dom',
        serveConfidence: 'high',
      },
      {
        prematchBaseline: baseline,
      },
    )

    expect(result.probabilityState.pFair.match.pMatchA).not.toBeNull()
    expect(result.decisionSnapshot.quality.tier === 'medium' || result.decisionSnapshot.quality.tier === 'high').toBe(true)
  })
})
