import { describe, expect, it } from 'vitest'

import type { TennisFeedMatch } from '../../realtime-score/tennis/types.js'
import { evaluateTennisPointRisk } from './pointRiskEngine.js'

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
      score: 0,
    },
    teamB: {
      name: 'Daniel Merida Aguilar',
      shortName: 'Merida Aguilar D.',
      code: 'MER',
      slug: 'daniel-m-a',
      playerId: 'WOtXbAu5',
      score: 0,
    },
    currentSet: {
      label: 'Set 2',
      teamAScore: '2',
      teamBScore: '2',
    },
    currentGame: {
      teamAScore: '15',
      teamBScore: '15',
    },
    serverSide: 'teamA',
    serverSideResolved: 'teamA',
    serverSideSource: 'dom',
    serveConfidence: 'high',
    serverPlayerName: 'Droguet T.',
    stats: null,
    sets: [],
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

describe('evaluateTennisPointRisk', () => {
  it('returns unavailable when score is missing outside live trading states', () => {
    const decision = evaluateTennisPointRisk(
      buildMatch({
        status: 'PRE',
        statusText: 'Scheduled',
        currentSet: null,
        currentGame: null,
      }),
    )
    expect(decision.available).toBe(false)
    expect(decision.machineCommand).toBeNull()
  })

  it('hard stops retired matches', () => {
    const decision = evaluateTennisPointRisk(
      buildMatch({
        status: 'FINAL',
        statusText: 'Retired',
      }),
    )

    expect(decision.available).toBe(true)
    expect(decision.machineCommand).toBe('STOP')
    expect(decision.stopTriggered).toBe(true)
    expect(decision.matchedRule).toBe('retired')
  })

  it('hard stops live matches with incomplete score payloads', () => {
    const decision = evaluateTennisPointRisk(
      buildMatch({
        currentGame: null,
      }),
    )

    expect(decision.available).toBe(true)
    expect(decision.machineCommand).toBe('STOP')
    expect(decision.stopTriggered).toBe(true)
    expect(decision.matchedRule).toBe('live score incomplete')
  })

  it('maps 2-2, 15-15 to normal run state', () => {
    const decision = evaluateTennisPointRisk(
      buildMatch({
        currentSet: { label: 'Set 2', teamAScore: '2', teamBScore: '2' },
        currentGame: { teamAScore: '15', teamBScore: '15' },
        serverSide: 'teamA',
      }),
    )

    expect(decision.machineCommand).toBe('RUN')
    expect(decision.matchedRule).toBe('2-2 15-15')
    expect(decision.baseRisk).toBe('low')
    expect(decision.finalRisk).toBe('low')
    expect(decision.matchContext?.setContext).toBe('normal_set')
  })

  it('keeps second-set 2-2, 30-0 as low risk even with a 1-0 set lead backdrop', () => {
    const base = buildMatch()
    const decision = evaluateTennisPointRisk(
      buildMatch({
        teamA: { ...base.teamA, score: 1 },
        teamB: { ...base.teamB, score: 0 },
        sets: [
          { label: 'Set 2', teamAScore: '2', teamBScore: '2' },
          { label: 'Set 1', teamAScore: '6', teamBScore: '3' },
        ],
        currentSet: { label: 'Set 2', teamAScore: '2', teamBScore: '2' },
        currentGame: { teamAScore: '30', teamBScore: '0' },
        serverSide: 'teamB',
      }),
    )

    expect(decision.matchContext?.setContext).toBe('closing_set')
    expect(decision.baseRisk).toBe('low')
    expect(decision.contextAdjustment).toBe(0)
    expect(decision.finalRisk).toBe('low')
    expect(decision.machineCommand).toBe('RUN')
  })

  it('maps 4-3, 30-30 with leader serving to warn', () => {
    const decision = evaluateTennisPointRisk(
      buildMatch({
        currentSet: { label: 'Set 2', teamAScore: '4', teamBScore: '3' },
        currentGame: { teamAScore: '30', teamBScore: '30' },
        serverSide: 'teamA',
      }),
    )

    expect(decision.machineCommand).toBe('WARN')
    expect(decision.serverContext).toBe('leader_serving')
    expect(decision.matchedRule).toBe('4-3 30-30 leader serving')
    expect(decision.baseRisk).toBe('medium')
  })

  it('maps 4-3, 30-30 with trailer serving to pause', () => {
    const decision = evaluateTennisPointRisk(
      buildMatch({
        currentSet: { label: 'Set 2', teamAScore: '4', teamBScore: '3' },
        currentGame: { teamAScore: '30', teamBScore: '30' },
        serverSide: 'teamB',
        serverPlayerName: 'Merida Aguilar D.',
      }),
    )

    expect(decision.machineCommand).toBe('PAUSE')
    expect(decision.serverContext).toBe('trailer_serving')
    expect(decision.baseRisk).toBe('high')
  })

  it('maps 5-4, 0-0 with trailer serving to hard stop', () => {
    const decision = evaluateTennisPointRisk(
      buildMatch({
        currentSet: { label: 'Set 2', teamAScore: '5', teamBScore: '4' },
        currentGame: { teamAScore: '0', teamBScore: '0' },
        serverSide: 'teamB',
        serverPlayerName: 'Merida Aguilar D.',
      }),
    )

    expect(decision.machineCommand).toBe('STOP')
    expect(decision.stopTriggered).toBe(true)
    expect(decision.matchedRule).toBe('5-4 0-0 trailer serving')
    expect(decision.baseRisk).toBe('very_high')
  })

  it('treats 5-4, 40-30 with leader serving as a set-ending pause', () => {
    const decision = evaluateTennisPointRisk(
      buildMatch({
        currentSet: { label: 'Set 2', teamAScore: '5', teamBScore: '4' },
        currentGame: { teamAScore: '40', teamBScore: '30' },
        serverSide: 'teamA',
      }),
    )

    expect(decision.machineCommand).toBe('PAUSE')
    expect(decision.baseRisk).toBe('very_high')
    expect(decision.matchedRule).toBe('server set point')
  })

  it('treats 5-4, 40-15 with leader serving as a set-ending pause', () => {
    const decision = evaluateTennisPointRisk(
      buildMatch({
        currentSet: { label: 'Set 2', teamAScore: '5', teamBScore: '4' },
        currentGame: { teamAScore: '40', teamBScore: '15' },
        serverSide: 'teamA',
      }),
    )

    expect(decision.machineCommand).toBe('PAUSE')
    expect(decision.baseRisk).toBe('very_high')
    expect(decision.matchedRule).toBe('server set point')
  })

  it('treats 5-4, 40-0 with leader serving as a set-ending pause', () => {
    const decision = evaluateTennisPointRisk(
      buildMatch({
        currentSet: { label: 'Set 2', teamAScore: '5', teamBScore: '4' },
        currentGame: { teamAScore: '40', teamBScore: '0' },
        serverSide: 'teamA',
      }),
    )

    expect(decision.machineCommand).toBe('PAUSE')
    expect(decision.baseRisk).toBe('very_high')
    expect(decision.matchedRule).toBe('server set point')
  })

  it('ignores unresolved serverSide in non-tiebreak rules and falls back to conservative generic pressure', () => {
    const decision = evaluateTennisPointRisk(
      buildMatch({
        currentSet: { label: 'Set 2', teamAScore: '5', teamBScore: '4' },
        currentGame: { teamAScore: '40', teamBScore: '15' },
        serverSide: null,
        serverSideResolved: null,
        serverSideSource: 'unknown',
        serveConfidence: 'low',
      }),
    )

    expect(decision.serverContext).toBe('any')
    expect(decision.baseRisk).toBe('very_high')
    expect(decision.machineCommand).toBe('PAUSE')
    expect(decision.matchedRule).toBe('generic set-ending pressure')
  })

  it('uses retry-resolved serverSide ahead of raw serverSide for non-tiebreak rules', () => {
    const decision = evaluateTennisPointRisk(
      buildMatch({
        currentSet: { label: 'Set 2', teamAScore: '4', teamBScore: '3' },
        currentGame: { teamAScore: '30', teamBScore: '30' },
        serverSide: null,
        serverSideResolved: 'teamB',
        serverSideSource: 'retry',
        serveConfidence: 'high',
      }),
    )

    expect(decision.serverContext).toBe('trailer_serving')
    expect(decision.baseRisk).toBe('high')
    expect(decision.machineCommand).toBe('PAUSE')
    expect(decision.matchedRule).toBe('4-3 30-30 trailer serving')
  })

  it('adds a conservative bump when only raw serverSide is available on a key point', () => {
    const decision = evaluateTennisPointRisk(
      buildMatch({
        currentSet: { label: 'Set 2', teamAScore: '4', teamBScore: '3' },
        currentGame: { teamAScore: '30', teamBScore: '30' },
        serverSide: 'teamA',
        serverSideResolved: null,
        serverSideSource: 'unknown',
        serveConfidence: 'low',
      }),
    )

    expect(decision.serverContext).toBe('leader_serving')
    expect(decision.baseRisk).toBe('medium')
    expect(decision.contextAdjustment).toBe(1)
    expect(decision.finalRisk).toBe('high')
    expect(decision.machineCommand).toBe('PAUSE')
  })

  it('treats 4-1, 15-40 with trailer serving as a moderate trailer hold point, not a terminal stop', () => {
    const decision = evaluateTennisPointRisk(
      buildMatch({
        currentSet: { label: 'Set 2', teamAScore: '4', teamBScore: '1' },
        currentGame: { teamAScore: '15', teamBScore: '40' },
        serverSide: 'teamB',
      }),
    )

    expect(decision.baseRisk).toBe('medium')
    expect(decision.machineCommand).toBe('WARN')
    expect(decision.matchedRule).toBe('fallback')
  })

  it('treats 4-2, 30-40 with trailer serving as break pressure pause', () => {
    const decision = evaluateTennisPointRisk(
      buildMatch({
        currentSet: { label: 'Set 2', teamAScore: '4', teamBScore: '2' },
        currentGame: { teamAScore: '30', teamBScore: '40' },
        serverSide: 'teamA',
      }),
    )

    expect(decision.baseRisk).toBe('high')
    expect(decision.machineCommand).toBe('PAUSE')
    expect(decision.matchedRule).toBe('break point pressure')
  })

  it('treats 4-3, 15-40 with leader serving as break pressure pause', () => {
    const decision = evaluateTennisPointRisk(
      buildMatch({
        currentSet: { label: 'Set 2', teamAScore: '4', teamBScore: '3' },
        currentGame: { teamAScore: '15', teamBScore: '40' },
        serverSide: 'teamA',
      }),
    )

    expect(decision.baseRisk).toBe('high')
    expect(decision.machineCommand).toBe('PAUSE')
    expect(decision.matchedRule).toBe('break point pressure')
  })

  it('treats 4-1, 0-40 with leader serving as break pressure pause', () => {
    const decision = evaluateTennisPointRisk(
      buildMatch({
        currentSet: { label: 'Set 2', teamAScore: '4', teamBScore: '1' },
        currentGame: { teamAScore: '0', teamBScore: '40' },
        serverSide: 'teamA',
      }),
    )

    expect(decision.baseRisk).toBe('high')
    expect(decision.machineCommand).toBe('PAUSE')
    expect(decision.matchedRule).toBe('break point pressure')
  })

  it('does not apply closing-set boost when the first-set leader is clearly trailing 2-4 in set two', () => {
    const base = buildMatch()
    const decision = evaluateTennisPointRisk(
      buildMatch({
        teamA: { ...base.teamA, score: 1 },
        teamB: { ...base.teamB, score: 0 },
        sets: [
          { label: 'Set 2', teamAScore: '2', teamBScore: '4' },
          { label: 'Set 1', teamAScore: '6', teamBScore: '3' },
        ],
        currentSet: { label: 'Set 2', teamAScore: '2', teamBScore: '4' },
        currentGame: { teamAScore: '15', teamBScore: '15' },
        serverSide: 'teamB',
      }),
    )

    expect(decision.matchContext?.setContext).toBe('closing_set')
    expect(decision.baseRisk).toBe('low')
    expect(decision.contextAdjustment).toBe(0)
    expect(decision.finalRisk).toBe('low')
    expect(decision.machineCommand).toBe('RUN')
  })

  it('elevates 4-2, 30-40 with missing server in a closing set to pause', () => {
    const base = buildMatch()
    const decision = evaluateTennisPointRisk(
      buildMatch({
        teamA: { ...base.teamA, score: 1 },
        teamB: { ...base.teamB, score: 0 },
        sets: [
          { label: 'Set 2', teamAScore: '4', teamBScore: '2' },
          { label: 'Set 1', teamAScore: '6', teamBScore: '3' },
        ],
        currentSet: { label: 'Set 2', teamAScore: '4', teamBScore: '2' },
        currentGame: { teamAScore: '30', teamBScore: '40' },
        serverSide: null,
        serverPlayerName: null,
      }),
    )

    expect(decision.baseRisk).toBe('medium')
    expect(decision.contextAdjustment).toBe(1)
    expect(decision.finalRisk).toBe('high')
    expect(decision.machineCommand).toBe('PAUSE')
    expect(decision.matchedRule).toBe('generic game point pressure')
  })

  it('treats 5-4, 40-15 with missing server as set-ending pressure', () => {
    const decision = evaluateTennisPointRisk(
      buildMatch({
        currentSet: { label: 'Set 2', teamAScore: '5', teamBScore: '4' },
        currentGame: { teamAScore: '40', teamBScore: '15' },
        serverSide: null,
        serverPlayerName: null,
      }),
    )

    expect(decision.baseRisk).toBe('very_high')
    expect(decision.machineCommand).toBe('PAUSE')
    expect(decision.matchedRule).toBe('generic set-ending pressure')
  })

  it('treats 5-4, 40-0 with missing server as set-ending pressure', () => {
    const decision = evaluateTennisPointRisk(
      buildMatch({
        currentSet: { label: 'Set 2', teamAScore: '5', teamBScore: '4' },
        currentGame: { teamAScore: '40', teamBScore: '0' },
        serverSide: null,
        serverPlayerName: null,
      }),
    )

    expect(decision.baseRisk).toBe('very_high')
    expect(decision.machineCommand).toBe('PAUSE')
    expect(decision.matchedRule).toBe('generic set-ending pressure')
  })

  it('treats 5-4, 30-40 with leader serving as receiver-side set point pause', () => {
    const decision = evaluateTennisPointRisk(
      buildMatch({
        currentSet: { label: 'Set 2', teamAScore: '5', teamBScore: '4' },
        currentGame: { teamAScore: '30', teamBScore: '40' },
        serverSide: 'teamA',
      }),
    )

    expect(decision.machineCommand).toBe('PAUSE')
    expect(decision.serverContext).toBe('receiver_set_point')
    expect(decision.matchedRule).toBe('receiver set point')
    expect(decision.matchContext?.setContext).toBe('normal_set')
  })

  it('treats 5-4, AD-40 with leader serving as server-side set point pause', () => {
    const decision = evaluateTennisPointRisk(
      buildMatch({
        currentSet: { label: 'Set 2', teamAScore: '5', teamBScore: '4' },
        currentGame: { teamAScore: 'AD', teamBScore: '40' },
        serverSide: 'teamA',
      }),
    )

    expect(decision.machineCommand).toBe('PAUSE')
    expect(decision.serverContext).toBe('server_set_point')
    expect(decision.matchedRule).toBe('server set point')
    expect(decision.finalRisk).toBe('very_high')
  })

  it('treats tiebreak 3-2 with leader serving as warn', () => {
    const decision = evaluateTennisPointRisk(
      buildMatch({
        currentSet: { label: 'Set 2 - Tiebreak', teamAScore: '6', teamBScore: '6' },
        currentGame: { teamAScore: '3', teamBScore: '2' },
        serverSide: 'teamA',
      }),
    )

    expect(decision.machineCommand).toBe('WARN')
    expect(decision.baseRisk).toBe('medium')
    expect(decision.matchedRule).toBe('TB 3-2 leader serving')
  })

  it('treats tiebreak 3-2 with trailer serving as pause', () => {
    const decision = evaluateTennisPointRisk(
      buildMatch({
        currentSet: { label: 'Set 2 - Tiebreak', teamAScore: '6', teamBScore: '6' },
        currentGame: { teamAScore: '3', teamBScore: '2' },
        serverSide: 'teamB',
      }),
    )

    expect(decision.machineCommand).toBe('PAUSE')
    expect(decision.baseRisk).toBe('high')
    expect(decision.matchedRule).toBe('TB 3-2 trailer serving')
  })

  it('ignores unresolved serverSide in tiebreak rules', () => {
    const decision = evaluateTennisPointRisk(
      buildMatch({
        currentSet: { label: 'Set 2 - Tiebreak', teamAScore: '6', teamBScore: '6' },
        currentGame: { teamAScore: '3', teamBScore: '2' },
        serverSide: null,
        serverSideResolved: null,
        serverSideSource: 'unknown',
        serveConfidence: 'low',
      }),
    )

    expect(decision.serverContext).toBe('any')
    expect(decision.baseRisk).toBe('high')
    expect(decision.machineCommand).toBe('PAUSE')
    expect(decision.matchedRule).toBe('TB 3-2 unknown server')
  })

  it('uses retry-resolved serverSide ahead of raw serverSide in tiebreak rules', () => {
    const decision = evaluateTennisPointRisk(
      buildMatch({
        currentSet: { label: 'Set 2 - Tiebreak', teamAScore: '6', teamBScore: '6' },
        currentGame: { teamAScore: '3', teamBScore: '2' },
        serverSide: null,
        serverSideResolved: 'teamA',
        serverSideSource: 'retry',
        serveConfidence: 'high',
      }),
    )

    expect(decision.serverContext).toBe('leader_serving')
    expect(decision.baseRisk).toBe('medium')
    expect(decision.machineCommand).toBe('WARN')
    expect(decision.matchedRule).toBe('TB 3-2 leader serving')
  })

  it('treats tiebreak 5-4 with leader serving as pause, not stop yet', () => {
    const decision = evaluateTennisPointRisk(
      buildMatch({
        currentSet: { label: 'Set 2 - Tiebreak', teamAScore: '6', teamBScore: '6' },
        currentGame: { teamAScore: '5', teamBScore: '4' },
        serverSide: 'teamA',
      }),
    )

    expect(decision.machineCommand).toBe('PAUSE')
    expect(decision.stopTriggered).toBe(false)
    expect(decision.baseRisk).toBe('very_high')
    expect(decision.matchedRule).toBe('TB 5-4 leader serving')
  })

  it('stops on extended tiebreak 6-6', () => {
    const decision = evaluateTennisPointRisk(
      buildMatch({
        currentSet: { label: 'Set 2 - Tiebreak', teamAScore: '6', teamBScore: '6' },
        currentGame: { teamAScore: '6', teamBScore: '6' },
        serverSide: 'teamA',
      }),
    )

    expect(decision.machineCommand).toBe('STOP')
    expect(decision.stopTriggered).toBe(true)
    expect(decision.matchedRule).toBe('TB 6-6')
  })

  it('stops on tiebreak 5-5', () => {
    const decision = evaluateTennisPointRisk(
      buildMatch({
        currentSet: { label: 'Set 2 - Tiebreak', teamAScore: '6', teamBScore: '6' },
        currentGame: { teamAScore: '5', teamBScore: '5' },
        serverSide: 'teamA',
      }),
    )

    expect(decision.phase).toBe('tiebreak')
    expect(decision.machineCommand).toBe('STOP')
    expect(decision.matchedRule).toBe('TB 5-5')
    expect(decision.baseRisk).toBe('very_high')
  })

  it('marks tiebreak 6-5 with leader serving as stop', () => {
    const decision = evaluateTennisPointRisk(
      buildMatch({
        currentSet: { label: 'Set 2 - Tiebreak', teamAScore: '6', teamBScore: '6' },
        currentGame: { teamAScore: '6', teamBScore: '5' },
        serverSide: 'teamA',
      }),
    )

    expect(decision.machineCommand).toBe('STOP')
    expect(decision.matchedRule).toBe('TB 6-5 leader serving')
  })

  it('treats 6-5, 40-30 as pause in non-tiebreak closing game', () => {
    const decision = evaluateTennisPointRisk(
      buildMatch({
        currentSet: { label: 'Set 2', teamAScore: '6', teamBScore: '5' },
        currentGame: { teamAScore: '40', teamBScore: '30' },
        serverSide: 'teamA',
      }),
    )

    expect(decision.machineCommand).toBe('PAUSE')
    expect(decision.matchedRule).toBe('server set point')
  })

  it('applies closing-set context adjustment only once the second set reaches a later key point', () => {
    const base = buildMatch()
    const decision = evaluateTennisPointRisk(
      buildMatch({
        teamA: { ...base.teamA, score: 1 },
        teamB: { ...base.teamB, score: 0 },
        sets: [
          { label: 'Set 2', teamAScore: '4', teamBScore: '3' },
          { label: 'Set 1', teamAScore: '7', teamBScore: '5' },
        ],
        currentSet: { label: 'Set 2', teamAScore: '4', teamBScore: '3' },
        currentGame: { teamAScore: '30', teamBScore: '30' },
        serverSide: 'teamB',
      }),
    )

    expect(decision.matchContext?.setContext).toBe('closing_set')
    expect(decision.contextAdjustment).toBe(1)
    expect(decision.baseRisk).toBe('high')
    expect(decision.finalRisk).toBe('very_high')
    expect(decision.machineCommand).toBe('PAUSE')
    expect(decision.matchContext?.canLeaderCloseMatchThisSet).toBe(true)
  })
})
