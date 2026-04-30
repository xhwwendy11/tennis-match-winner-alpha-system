import { describe, expect, it } from 'vitest'

import { buildSnapshotQuality } from './snapshotQuality.js'
import type { CanonicalMatchState } from './canonicalMatchState.js'
import type { PrematchBaseline } from './prematchBaseline.js'
import type { ResolvedStats } from './resolvedStats.js'
import type { TennisProbabilityState } from '../probability/probabilityState.js'

function makeState(overrides: Partial<CanonicalMatchState> = {}): CanonicalMatchState {
  return {
    matchId: 'evt-1',
    source: {
      sourceKind: 'flashscore',
      matchUrl: 'https://www.flashscore.com/match/tennis/example',
      sourcePageUrl: 'https://www.flashscore.com/match/tennis/example',
    },
    competition: {
      tournamentName: 'Sample',
      tournamentLabel: 'Sample',
      tournamentPath: '/tennis/atp-singles/sample',
      round: 'R32',
      bestOf: 3,
      tourType: 'ATP',
      gender: 'men',
      discipline: 'singles',
      startTimeISO: '2026-04-22T18:00:00Z',
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
      setIndex: 1,
      setsWonA: 0,
      setsWonB: 0,
      currentSetGamesA: 2,
      currentSetGamesB: 2,
      currentGamePointsA: '15',
      currentGamePointsB: '15',
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
      ingestedAt: '2026-04-22T18:00:00Z',
      scoreTimestamp: '2026-04-22T18:00:00Z',
      serveTimestamp: '2026-04-22T18:00:00Z',
      statsTimestamp: null,
    },
    ...overrides,
  }
}

function makeBaseline(overrides: Partial<PrematchBaseline> = {}): PrematchBaseline {
  return {
    source: 'tour_official',
    complete: true,
    bestOf: 3,
    surface: 'hard',
    tourType: 'ATP',
    prematchFairProbA: null,
    prematchFairProbB: null,
    strengthBucketA: 'unknown',
    strengthBucketB: 'unknown',
    holdBaselineA: 0.8,
    holdBaselineB: 0.78,
    breakBaselineA: 0.2,
    breakBaselineB: 0.22,
    ...overrides,
  }
}

function makeProbabilityState(overrides: Partial<TennisProbabilityState['pFair']['match']> = {}): TennisProbabilityState {
  return {
    version: 'tennis-probability-state/v1',
    available: true,
    baseline: makeBaseline(),
    pFair: {
      version: 'p-fair/v1',
      point: { serverSide: 'teamA', pPointA: 0.55, pPointB: 0.45, source: 'derived' },
      game: { serverSide: 'teamA', pGameA: 0.6, pGameB: 0.4, pHoldServer: 0.6, pBreakReceiver: 0.4, source: 'derived' },
      set: { pSetA: 0.58, pSetB: 0.42, source: 'derived' },
      match: { pMatchA: 0.57, pMatchB: 0.43, source: 'derived', ...overrides },
      anchor: {
        prematchFairProbA: null,
        prematchFairProbB: null,
        holdBaselineA: 0.8,
        holdBaselineB: 0.78,
        breakBaselineA: 0.2,
        breakBaselineB: 0.22,
      },
      diagnostics: {
        setIndex: 1,
        isTiebreak: false,
        pointScoreA: '15',
        pointScoreB: '15',
        gameScoreA: 2,
        gameScoreB: 2,
        riskRule: null,
        integrity: 'ok',
        statsAdjustmentA: 0,
        statsAdjustmentB: 0,
      },
    },
  }
}

function makeStats(): ResolvedStats {
  return {
    pointsWonA: { value: 20, source: 'flashscore', confidence: 'medium' },
    pointsWonB: { value: 18, source: 'flashscore', confidence: 'medium' },
  } as ResolvedStats
}

describe('buildSnapshotQuality', () => {
  it('marks official baseline with live stats as high quality', () => {
    const quality = buildSnapshotQuality({
      matchState: makeState(),
      prematchBaseline: makeBaseline(),
      probabilityState: makeProbabilityState(),
      resolvedStats: makeStats(),
    })

    expect(quality).toEqual({
      tier: 'high',
      reason: 'official_baseline_live_stats',
      unsupported: false,
    })
  })

  it('marks flashscore history baseline with live stats as medium quality', () => {
    const quality = buildSnapshotQuality({
      matchState: makeState(),
      prematchBaseline: makeBaseline({ source: 'flashscore_history' }),
      probabilityState: makeProbabilityState(),
      resolvedStats: makeStats(),
    })

    expect(quality.tier).toBe('medium')
    expect(quality.reason).toBe('historical_baseline_live_stats')
  })

  it('marks doubles as unusable unsupported samples', () => {
    const quality = buildSnapshotQuality({
      matchState: makeState({
        competition: {
          ...makeState().competition,
          discipline: 'doubles',
        },
      }),
      prematchBaseline: makeBaseline(),
      probabilityState: makeProbabilityState(),
      resolvedStats: makeStats(),
    })

    expect(quality).toEqual({
      tier: 'unusable',
      reason: 'unsupported_doubles',
      unsupported: true,
    })
  })
})
