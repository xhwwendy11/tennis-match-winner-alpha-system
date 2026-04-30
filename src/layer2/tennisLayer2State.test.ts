import { describe, expect, it } from 'vitest'

import { buildCanonicalMatchState } from '../foundation/canonicalMatchState.js'
import { buildTennisLayer2State } from './tennisLayer2State.js'
import { evaluateTennisPointRisk } from '../rules/tennis/pointRiskEngine.js'
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
      teamAScore: '4',
      teamBScore: '3',
    },
    currentGame: {
      teamAScore: '30',
      teamBScore: '30',
    },
    serverSide: 'teamA',
    serverSideResolved: 'teamA',
    serverSideSource: 'dom',
    serveConfidence: 'high',
    serverPlayerName: 'Medvedev',
    stats: null,
    sets: [
      { label: 'Set 1', teamAScore: '4', teamBScore: '6' },
      { label: 'Set 2', teamAScore: '4', teamBScore: '3' },
    ],
    matchUrl: 'https://www.flashscore.com/match/tennis/example',
    sourcePageUrl: 'https://www.flashscore.com/match/tennis/example',
    ...overrides,
  }
}

describe('buildTennisLayer2State', () => {
  it('builds a probability state with null pFair when no baseline is present', () => {
    const match = makeMatch()
    const state = buildCanonicalMatchState(match)
    const pointRisk = evaluateTennisPointRisk(match)
    const layer2 = buildTennisLayer2State({ state, pointRisk })

    expect(layer2.version).toBe('tennis-probability-state/v1')
    expect(layer2.available).toBe(true)
    expect(layer2.pFair.match.source).toBe('none')
    expect(layer2.pFair.match.pMatchA).toBeNull()
    expect(layer2.pFair.game.pGameA).toBeNull()
    expect(layer2.risk.level).toBe('high')
    expect(layer2.risk.machineCommand).toBe('PAUSE')
    expect(layer2.risk.riskDrivers).toContain('closing_set')
    expect(layer2.risk.riskDrivers).toContain('rule:4-3 30-30 leader serving')
  })

  it('uses supplied prematch baseline as the first pFair source', () => {
    const match = makeMatch()
    const state = buildCanonicalMatchState(match)
    const pointRisk = evaluateTennisPointRisk(match)
    const layer2 = buildTennisLayer2State({
      state,
      pointRisk,
      baseline: {
        source: 'market',
        complete: true,
        bestOf: 3,
        surface: 'clay',
        tourType: 'ATP',
        prematchFairProbA: 0.62,
        prematchFairProbB: 0.38,
        strengthBucketA: 'favorite',
        strengthBucketB: 'underdog',
        holdBaselineA: 0.82,
        holdBaselineB: 0.78,
        breakBaselineA: 0.24,
        breakBaselineB: 0.19,
      },
    })

    expect(layer2.pFair.match.source).toBe('derived')
    expect(layer2.pFair.point.source).toBe('derived')
    expect(layer2.pFair.game.pHoldServer).not.toBeNull()
    expect(layer2.pFair.match.pMatchA).not.toBeNull()
    expect((layer2.pFair.match.pMatchA ?? 0) + (layer2.pFair.match.pMatchB ?? 0)).toBeCloseTo(1, 6)
    expect(layer2.pFair.anchor.prematchFairProbA).toBe(0.62)
    expect(layer2.baseline.surface).toBe('clay')
    expect(layer2.baseline.holdBaselineA).toBe(0.82)
  })

  it('passes resolved stats into pFair diagnostics', () => {
    const match = makeMatch()
    const state = buildCanonicalMatchState(match)
    const pointRisk = evaluateTennisPointRisk(match)
    const layer2 = buildTennisLayer2State({
      state,
      pointRisk,
      baseline: {
        source: 'market',
        complete: true,
        bestOf: 3,
        surface: 'clay',
        tourType: 'ATP',
        prematchFairProbA: 0.62,
        prematchFairProbB: 0.38,
        strengthBucketA: 'favorite',
        strengthBucketB: 'underdog',
        holdBaselineA: 0.82,
        holdBaselineB: 0.78,
        breakBaselineA: 0.24,
        breakBaselineB: 0.19,
      },
      resolvedStats: {
        acesA: { value: null, source: 'none', confidence: 'low' },
        acesB: { value: null, source: 'none', confidence: 'low' },
        doubleFaultsA: { value: 0, source: 'kalshi_ui', confidence: 'high' },
        doubleFaultsB: { value: 3, source: 'kalshi_ui', confidence: 'high' },
        pointsWonA: { value: 70, source: 'kalshi_ui', confidence: 'high' },
        pointsWonB: { value: 55, source: 'kalshi_ui', confidence: 'high' },
        firstServeWonA: { value: null, source: 'none', confidence: 'low' },
        firstServeWonB: { value: null, source: 'none', confidence: 'low' },
        secondServeWonA: { value: null, source: 'none', confidence: 'low' },
        secondServeWonB: { value: null, source: 'none', confidence: 'low' },
        serviceGamesWonA: { value: 7, source: 'kalshi_ui', confidence: 'high' },
        serviceGamesWonB: { value: 5, source: 'kalshi_ui', confidence: 'high' },
        breakPointsDisplayA: { value: null, source: 'none', confidence: 'low' },
        breakPointsDisplayB: { value: null, source: 'none', confidence: 'low' },
      },
    })

    expect(layer2.pFair.diagnostics.statsAdjustmentA).toBeGreaterThan(0)
    expect(layer2.pFair.point.pPointA).toBeGreaterThan(0.5)
  })
})
