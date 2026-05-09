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
    pointBaselineA: 0.68,
    pointBaselineB: 0.64,
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

  it('uses live serve-point samples to blend baseline point probabilities', () => {
    const withoutStats = buildPFairState({
      state: makeState(),
      baseline: makeBaseline(),
      pointRisk: makePointRisk(),
    })

    const withStats = buildPFairState({
      state: makeState(),
      baseline: makeBaseline(),
      pointRisk: makePointRisk({
        finalRisk: 'medium',
      }),
      resolvedStats: makeResolvedStats({
        firstServeWonA: { value: '44/60', source: 'flashscore', confidence: 'medium' },
        secondServeWonA: { value: '17/26', source: 'flashscore', confidence: 'medium' },
        firstServeWonB: { value: '31/55', source: 'flashscore', confidence: 'medium' },
        secondServeWonB: { value: '11/27', source: 'flashscore', confidence: 'medium' },
      }),
    })

    expect(withStats.point.pPointA).toBeGreaterThan(withoutStats.point.pPointA ?? 0)
    expect(withStats.diagnostics.firstServeInLiveA).toBeCloseTo(60 / 86, 6)
    expect(withStats.diagnostics.firstServeWonLiveA).toBeCloseTo(44 / 60, 6)
    expect(withStats.diagnostics.secondServeWonLiveA).toBeCloseTo(17 / 26, 6)
    expect(withStats.diagnostics.pointLiveA).toBeCloseTo(61 / 86, 6)
    expect(withStats.diagnostics.pointLiveB).toBeCloseTo(42 / 82, 6)
    expect((withStats.diagnostics.preWeightA ?? 0) + (withStats.diagnostics.liveWeightA ?? 0)).toBeCloseTo(1, 6)
    expect(withStats.diagnostics.pointFairA).toBeGreaterThan(withoutStats.diagnostics.pointFairA ?? 0)
  })

  it('prefers explicit point baselines over hold-to-point mapping', () => {
    const pFair = buildPFairState({
      state: makeState(),
      baseline: makeBaseline({
        pointBaselineA: 0.67,
        holdBaselineA: 0.95,
      }),
      pointRisk: makePointRisk({
        finalRisk: 'medium',
        stopTriggered: false,
      }),
    })

    expect(pFair.point.pPointA).toBeCloseTo(0.67, 6)
    expect(pFair.anchor.pointBaselineA).toBe(0.67)
  })

  it('lets larger live samples take more control of point fair', () => {
    const smallerSample = buildPFairState({
      state: makeState(),
      baseline: makeBaseline(),
      pointRisk: makePointRisk({
        finalRisk: 'medium',
      }),
      resolvedStats: makeResolvedStats({
        firstServeWonA: { value: '12/18', source: 'flashscore', confidence: 'medium' },
        secondServeWonA: { value: '6/10', source: 'flashscore', confidence: 'medium' },
        firstServeWonB: { value: '10/17', source: 'flashscore', confidence: 'medium' },
        secondServeWonB: { value: '5/11', source: 'flashscore', confidence: 'medium' },
      }),
    })

    const largerSample = buildPFairState({
      state: makeState(),
      baseline: makeBaseline(),
      pointRisk: makePointRisk({
        finalRisk: 'medium',
      }),
      resolvedStats: makeResolvedStats({
        firstServeWonA: { value: '44/60', source: 'flashscore', confidence: 'medium' },
        secondServeWonA: { value: '17/26', source: 'flashscore', confidence: 'medium' },
        firstServeWonB: { value: '31/55', source: 'flashscore', confidence: 'medium' },
        secondServeWonB: { value: '11/27', source: 'flashscore', confidence: 'medium' },
      }),
    })

    expect(largerSample.diagnostics.liveSampleA).toBeGreaterThan(smallerSample.diagnostics.liveSampleA ?? 0)
    expect(largerSample.diagnostics.pointFairA).toBeGreaterThan(smallerSample.diagnostics.pointFairA ?? 0)
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
