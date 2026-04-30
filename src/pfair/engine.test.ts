import { describe, expect, it } from 'vitest'

import { buildPFairState } from './engine.js'
import type { CanonicalMatchState } from '../foundation/canonicalMatchState.js'
import type { PrematchBaseline } from '../foundation/prematchBaseline.js'
import type { ResolvedStats } from '../foundation/resolvedStats.js'
import type { TennisPointRiskDecision } from '../rules/tennis/pointRiskEngine.js'

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
      teamA: { name: 'A', shortName: 'A', code: 'A', slug: 'a', playerId: 'a1' },
      teamB: { name: 'B', shortName: 'B', code: 'B', slug: 'b', playerId: 'b1' },
    },
    status: {
      matchStatus: 'LIVE',
      statusText: 'Live',
      abnormalReason: 'none',
    },
    scoreboard: {
      setIndex: 2,
      setsWonA: 1,
      setsWonB: 0,
      currentSetGamesA: 4,
      currentSetGamesB: 3,
      currentGamePointsA: '30',
      currentGamePointsB: '30',
      isTiebreak: false,
    },
    serve: {
      raw: 'teamA',
      resolved: 'teamA',
      source: 'dom',
      confidence: 'high',
      syncState: 'synced',
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
      servicePointsWonA: null,
      servicePointsWonB: null,
      firstServeReturnPointsWonA: null,
      firstServeReturnPointsWonB: null,
      secondServeReturnPointsWonA: null,
      secondServeReturnPointsWonB: null,
      returnPointsWonA: null,
      returnPointsWonB: null,
      serviceGamesWonA: null,
      serviceGamesWonB: null,
      returnGamesWonA: null,
      returnGamesWonB: null,
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
      scoreTimestamp: '2026-04-13T00:00:00Z',
      serveTimestamp: '2026-04-13T00:00:00Z',
      statsTimestamp: null,
    },
    ...overrides,
  }
}

function makeBaseline(overrides: Partial<PrematchBaseline> = {}): PrematchBaseline {
  return {
    source: 'market',
    complete: true,
    bestOf: 3,
    surface: 'clay',
    tourType: 'ATP',
    prematchFairProbA: 0.61,
    prematchFairProbB: 0.39,
    strengthBucketA: 'favorite',
    strengthBucketB: 'underdog',
    holdBaselineA: 0.82,
    holdBaselineB: 0.78,
    breakBaselineA: 0.24,
    breakBaselineB: 0.19,
    ...overrides,
  }
}

function makePointRisk(overrides: Partial<TennisPointRiskDecision> = {}): TennisPointRiskDecision {
  return {
    version: 'tennis-point-risk/v2-best-of-3',
    available: true,
    phase: 'non_tiebreak',
    stateLabel: '4-3 30-30',
    matchContext: {
      matchFormat: 'best_of_3',
      setIndex: 2,
      setsWonA: 1,
      setsWonB: 0,
      setContext: 'closing_set',
      isDecidingSet: false,
      canLeaderCloseMatchThisSet: true,
    },
    serverContext: 'leader_serving',
    baseRisk: 'medium',
    contextAdjustment: 1,
    finalRisk: 'high',
    structuralNote: null,
    marketBehavior: null,
    recommendation: null,
    machineCommand: 'PAUSE',
    stopTriggered: false,
    matchedRule: '4-3 30-30 leader serving',
    ...overrides,
  }
}

function makeResolvedStats(overrides: Partial<ResolvedStats> = {}): ResolvedStats {
  return {
    acesA: { value: null, source: 'none', confidence: 'low' },
    acesB: { value: null, source: 'none', confidence: 'low' },
    doubleFaultsA: { value: null, source: 'none', confidence: 'low' },
    doubleFaultsB: { value: null, source: 'none', confidence: 'low' },
    firstServePercentageA: { value: null, source: 'none', confidence: 'low' },
    firstServePercentageB: { value: null, source: 'none', confidence: 'low' },
    pointsWonA: { value: null, source: 'none', confidence: 'low' },
    pointsWonB: { value: null, source: 'none', confidence: 'low' },
    firstServeWonA: { value: null, source: 'none', confidence: 'low' },
    firstServeWonB: { value: null, source: 'none', confidence: 'low' },
    secondServeWonA: { value: null, source: 'none', confidence: 'low' },
    secondServeWonB: { value: null, source: 'none', confidence: 'low' },
    servicePointsWonA: { value: null, source: 'none', confidence: 'low' },
    servicePointsWonB: { value: null, source: 'none', confidence: 'low' },
    firstServeReturnPointsWonA: { value: null, source: 'none', confidence: 'low' },
    firstServeReturnPointsWonB: { value: null, source: 'none', confidence: 'low' },
    secondServeReturnPointsWonA: { value: null, source: 'none', confidence: 'low' },
    secondServeReturnPointsWonB: { value: null, source: 'none', confidence: 'low' },
    returnPointsWonA: { value: null, source: 'none', confidence: 'low' },
    returnPointsWonB: { value: null, source: 'none', confidence: 'low' },
    serviceGamesWonA: { value: null, source: 'none', confidence: 'low' },
    serviceGamesWonB: { value: null, source: 'none', confidence: 'low' },
    returnGamesWonA: { value: null, source: 'none', confidence: 'low' },
    returnGamesWonB: { value: null, source: 'none', confidence: 'low' },
    breakPointsSavedA: { value: null, source: 'none', confidence: 'low' },
    breakPointsSavedB: { value: null, source: 'none', confidence: 'low' },
    breakPointsConvertedA: { value: null, source: 'none', confidence: 'low' },
    breakPointsConvertedB: { value: null, source: 'none', confidence: 'low' },
    breakPointsDisplayA: { value: null, source: 'none', confidence: 'low' },
    breakPointsDisplayB: { value: null, source: 'none', confidence: 'low' },
    ...overrides,
  }
}

describe('buildPFairState', () => {
  it('builds full point/game/set/match fair probabilities', () => {
    const pFair = buildPFairState({
      state: makeState(),
      baseline: makeBaseline(),
      pointRisk: makePointRisk(),
    })

    expect(pFair.version).toBe('p-fair/v1')
    expect(pFair.point.source).toBe('derived')
    expect(pFair.game.source).toBe('derived')
    expect(pFair.set.source).toBe('derived')
    expect(pFair.match.source).toBe('derived')
    expect(pFair.point.pPointA).not.toBeNull()
    expect(pFair.game.pGameA).not.toBeNull()
    expect(pFair.game.pHoldServer).not.toBeNull()
    expect(pFair.set.pSetA).not.toBeNull()
    expect(pFair.match.pMatchA).not.toBeNull()
    expect((pFair.match.pMatchA ?? 0) + (pFair.match.pMatchB ?? 0)).toBeCloseTo(1, 6)
  })

  it('falls back to baseline-only match probabilities when live recursion inputs are missing', () => {
    const pFair = buildPFairState({
      state: makeState({
        serve: {
          raw: null,
          resolved: null,
          source: 'unknown',
          confidence: 'low',
          syncState: 'unknown',
        },
      }),
      baseline: makeBaseline(),
      pointRisk: makePointRisk(),
    })

    expect(pFair.point.source).toBe('none')
    expect(pFair.game.source).toBe('none')
    expect(pFair.set.source).toBe('none')
    expect(pFair.match.source).toBe('baseline')
    expect(pFair.match.pMatchA).toBe(0.61)
    expect(pFair.match.pMatchB).toBe(0.39)
  })

  it('uses resolved stats as a light adjustment on point-level fair probability', () => {
    const withoutStats = buildPFairState({
      state: makeState(),
      baseline: makeBaseline(),
      pointRisk: makePointRisk(),
    })

    const withStats = buildPFairState({
      state: makeState(),
      baseline: makeBaseline(),
      pointRisk: makePointRisk(),
      resolvedStats: makeResolvedStats({
        pointsWonA: { value: 80, source: 'kalshi_ui', confidence: 'high' },
        pointsWonB: { value: 60, source: 'kalshi_ui', confidence: 'high' },
        serviceGamesWonA: { value: 8, source: 'kalshi_ui', confidence: 'high' },
        serviceGamesWonB: { value: 5, source: 'kalshi_ui', confidence: 'high' },
        doubleFaultsA: { value: 1, source: 'kalshi_ui', confidence: 'high' },
        doubleFaultsB: { value: 4, source: 'kalshi_ui', confidence: 'high' },
      }),
    })

    expect(withStats.point.pPointA).toBeGreaterThan(withoutStats.point.pPointA ?? 0)
    expect(withStats.diagnostics.statsAdjustmentA).toBeGreaterThan(0)
    expect(withStats.diagnostics.statsAdjustmentB).toBeLessThan(0)
  })

  it('uses return-side stats as a light positive adjustment when team A is outperforming on return', () => {
    const withoutReturnStats = buildPFairState({
      state: makeState(),
      baseline: makeBaseline(),
      pointRisk: makePointRisk(),
      resolvedStats: makeResolvedStats({
        pointsWonA: { value: 70, source: 'flashscore', confidence: 'medium' },
        pointsWonB: { value: 70, source: 'flashscore', confidence: 'medium' },
      }),
    })

    const withReturnStats = buildPFairState({
      state: makeState(),
      baseline: makeBaseline(),
      pointRisk: makePointRisk(),
      resolvedStats: makeResolvedStats({
        pointsWonA: { value: 70, source: 'flashscore', confidence: 'medium' },
        pointsWonB: { value: 70, source: 'flashscore', confidence: 'medium' },
        returnPointsWonA: { value: '52% (26/50)', source: 'flashscore', confidence: 'medium' },
        returnPointsWonB: { value: '41% (18/44)', source: 'flashscore', confidence: 'medium' },
        firstServeReturnPointsWonA: { value: '38% (10/26)', source: 'flashscore', confidence: 'medium' },
        firstServeReturnPointsWonB: { value: '29% (7/24)', source: 'flashscore', confidence: 'medium' },
        secondServeReturnPointsWonA: { value: '67% (16/24)', source: 'flashscore', confidence: 'medium' },
        secondServeReturnPointsWonB: { value: '45% (11/20)', source: 'flashscore', confidence: 'medium' },
        breakPointsSavedA: { value: '75% (3/4)', source: 'flashscore', confidence: 'medium' },
        breakPointsSavedB: { value: '50% (2/4)', source: 'flashscore', confidence: 'medium' },
        breakPointsConvertedA: { value: '50% (2/4)', source: 'flashscore', confidence: 'medium' },
        breakPointsConvertedB: { value: '20% (1/5)', source: 'flashscore', confidence: 'medium' },
      }),
    })

    expect(withReturnStats.point.pPointA).toBeGreaterThan(withoutReturnStats.point.pPointA ?? 0)
    expect(withReturnStats.diagnostics.statsAdjustmentA).toBeGreaterThan(withoutReturnStats.diagnostics.statsAdjustmentA ?? 0)
    expect(withReturnStats.diagnostics.statsAdjustmentB).toBeLessThan(withoutReturnStats.diagnostics.statsAdjustmentB ?? 0)
  })

  it('does not overflow on abnormal long tiebreak point states', () => {
    const pFair = buildPFairState({
      state: makeState({
        scoreboard: {
          setIndex: 2,
          setsWonA: 1,
          setsWonB: 0,
          currentSetGamesA: 6,
          currentSetGamesB: 6,
          currentGamePointsA: '41',
          currentGamePointsB: '40',
          isTiebreak: true,
        },
      }),
      baseline: makeBaseline(),
      pointRisk: makePointRisk(),
      resolvedStats: makeResolvedStats(),
    })

    expect(pFair.game.source).toBe('derived')
    expect(pFair.game.pGameA).not.toBeNull()
    expect(pFair.game.pGameA).toBeGreaterThanOrEqual(0)
    expect(pFair.game.pGameA).toBeLessThanOrEqual(1)
  })
})
