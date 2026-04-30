import { describe, expect, it } from 'vitest'

import type { TennisFeedMatch } from '../../realtime-score/tennis/types.js'
import { evaluateTennisPointRisk } from './pointRiskEngine.js'
import { deriveTennisTradePlan } from './tradePlan.js'

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
    currentSet: { label: 'Set 2', teamAScore: '2', teamBScore: '2' },
    currentGame: { teamAScore: '15', teamBScore: '15' },
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

describe('deriveTennisTradePlan', () => {
  it('maps warn states to light maker reversion', () => {
    const match = buildMatch({
      currentSet: { label: 'Set 2', teamAScore: '4', teamBScore: '3' },
      currentGame: { teamAScore: '30', teamBScore: '30' },
      serverSide: 'teamA',
    })
    const pointRisk = evaluateTennisPointRisk(match)
    const plan = deriveTennisTradePlan(match, pointRisk)

    expect(plan.tradeMode).toBe('maker_reversion_light')
    expect(plan.exposureAllowed).toBe(true)
    expect(plan.maxExposureTier).toBe('small')
    expect(plan.preferredSide).toBe('extreme_low_price_side')
  })

  it('maps normal pause states to minimal maker reversion', () => {
    const match = buildMatch({
      currentSet: { label: 'Set 2', teamAScore: '4', teamBScore: '3' },
      currentGame: { teamAScore: '30', teamBScore: '30' },
      serverSide: 'teamB',
    })
    const pointRisk = evaluateTennisPointRisk(match)
    const plan = deriveTennisTradePlan(match, pointRisk)

    expect(plan.tradeMode).toBe('maker_reversion_minimal')
    expect(plan.exposureAllowed).toBe(true)
    expect(plan.maxExposureTier).toBe('minimal')
  })

  it('maps hot pause states to pause_only', () => {
    const match = buildMatch({
      currentSet: { label: 'Set 2 - Tiebreak', teamAScore: '6', teamBScore: '6' },
      currentGame: { teamAScore: '5', teamBScore: '4' },
      serverSide: 'teamA',
    })
    const pointRisk = evaluateTennisPointRisk(match)
    const plan = deriveTennisTradePlan(match, pointRisk)

    expect(pointRisk.machineCommand).toBe('PAUSE')
    expect(plan.tradeMode).toBe('pause_only')
    expect(plan.exposureAllowed).toBe(false)
    expect(plan.makerOnly).toBe(true)
  })

  it('maps hard stop states to hard_stop', () => {
    const match = buildMatch({
      currentSet: { label: 'Set 2 - Tiebreak', teamAScore: '6', teamBScore: '6' },
      currentGame: { teamAScore: '5', teamBScore: '5' },
      serverSide: 'teamA',
    })
    const pointRisk = evaluateTennisPointRisk(match)
    const plan = deriveTennisTradePlan(match, pointRisk)

    expect(pointRisk.machineCommand).toBe('STOP')
    expect(plan.tradeMode).toBe('hard_stop')
    expect(plan.exposureAllowed).toBe(false)
    expect(plan.exitMode).toBe('force_exit')
  })

  it('hard stops abnormal match states', () => {
    const match = buildMatch({
      status: 'FINAL',
      statusText: 'Retired',
    })
    const pointRisk = evaluateTennisPointRisk(match)
    const plan = deriveTennisTradePlan(match, pointRisk)

    expect(pointRisk.machineCommand).toBe('STOP')
    expect(plan.tradeMode).toBe('hard_stop')
    expect(plan.forceExitOnStop).toBe(true)
    expect(plan.exposureAllowed).toBe(false)
  })
})
