import { describe, expect, it } from 'vitest'

import type { DecisionSnapshot } from './decisionSnapshot.js'
import {
  inferSnapshotEdgeSignal,
  inferSnapshotLiveDecision,
  inferSnapshotQuality,
  snapshotEdgeSignalBucket,
} from './snapshotReportEnrichment.js'

function makeLegacySnapshot(overrides: Partial<DecisionSnapshot> = {}): DecisionSnapshot {
  return {
    version: 'decision-snapshot/v1',
    capturedAt: '2026-04-22T20:00:00.000Z',
    urls: {
      flashscoreMatchUrl: 'https://www.flashscore.com/match/tennis/a/b/',
      flashscoreSourcePageUrl: null,
      kalshiMarketUrl: 'https://kalshi.com/markets/example',
    },
    match: {
      matchId: 'match-1',
      tournamentName: 'ATP Example',
      round: 'Round of 32',
      gender: 'men',
      discipline: 'singles',
      teamA: 'Player A',
      teamB: 'Player B',
      status: 'LIVE',
      abnormalReason: 'none',
      setIndex: 1,
      isTiebreak: false,
      setsWonA: 0,
      setsWonB: 0,
      currentSetGamesA: 3,
      currentSetGamesB: 2,
      currentGamePointsA: '30',
      currentGamePointsB: '15',
      serverSide: 'teamA',
      matchIntegrity: 'ok',
    },
    sourceCoverage: {
      flashscoreStatsAvailable: true,
      kalshiStatsAvailable: true,
      prematchBaselineAvailable: true,
      marketStateAvailable: true,
    },
    market: null,
    fairVsMarket: {
      available: true,
      marketTicker: 'mkt',
      marketStatus: 'OPEN',
      fairProbA: 0.72,
      fairProbB: 0.28,
      marketProbA: { bid: 0.59, ask: 0.61, mid: 0.6, last: 0.6 },
      marketProbB: { bid: 0.39, ask: 0.41, mid: 0.4, last: 0.4 },
      edgeA: { vsBid: 0.13, vsAsk: 0.11, vsMid: 0.12, vsLast: 0.12 },
      edgeB: { vsBid: -0.11, vsAsk: -0.13, vsMid: -0.12, vsLast: -0.12 },
    },
    stats: {
      resolved: {
        pointsWonA: { value: 40, source: 'flashscore', confidence: 'medium' },
      } as never,
      kalshiDisplay: null,
    },
    prematchBaseline: {
      source: 'tour_official',
      complete: true,
      bestOf: 3,
      surface: null,
      tourType: 'ATP',
      prematchFairProbA: 0.52,
      prematchFairProbB: 0.48,
      strengthBucketA: 'slight_favorite',
      strengthBucketB: 'slight_underdog',
      holdBaselineA: 0.82,
      holdBaselineB: 0.78,
      breakBaselineA: 0.22,
      breakBaselineB: 0.18,
    },
    risk: {
      level: 'medium',
      machineCommand: 'WARN',
      matchedRule: 'fallback',
      phase: 'non_tiebreak',
      stopTriggered: false,
    },
    pFair: {
      version: 'p-fair/v1',
      point: { serverSide: 'teamA', pPointA: 0.64, pPointB: 0.36, source: 'derived' },
      game: { serverSide: 'teamA', pGameA: 0.72, pGameB: 0.28, pHoldServer: 0.72, pBreakReceiver: 0.28, source: 'derived' },
      set: { pSetA: 0.7, pSetB: 0.3, source: 'derived' },
      match: { pMatchA: 0.72, pMatchB: 0.28, source: 'derived' },
      anchor: {
        prematchFairProbA: 0.52,
        prematchFairProbB: 0.48,
        holdBaselineA: 0.82,
        holdBaselineB: 0.78,
        breakBaselineA: 0.22,
        breakBaselineB: 0.18,
      },
      diagnostics: {
        setIndex: 1,
        isTiebreak: false,
        pointScoreA: '30',
        pointScoreB: '15',
        gameScoreA: 3,
        gameScoreB: 2,
        riskRule: 'fallback',
        integrity: 'ok',
        statsAdjustmentA: 0,
        statsAdjustmentB: 0,
      },
    },
    tradePlan: {
      tradeMode: 'watch_only',
      jumpPhase: false,
      exposureAllowed: false,
      preferredSide: 'none',
      summary: 'watch',
    },
    ...overrides,
  } as DecisionSnapshot
}

describe('snapshotReportEnrichment', () => {
  it('infers quality for legacy snapshots without mutating stored data', () => {
    const snapshot = makeLegacySnapshot()
    delete (snapshot as Partial<DecisionSnapshot>).quality

    expect(inferSnapshotQuality(snapshot)).toEqual({
      tier: 'high',
      reason: 'official_baseline_live_stats',
      unsupported: false,
    })
  })

  it('infers edge signals for legacy snapshots using inferred quality', () => {
    const snapshot = makeLegacySnapshot()
    delete (snapshot as Partial<DecisionSnapshot>).quality
    delete (snapshot as Partial<DecisionSnapshot>).edgeSignal

    expect(inferSnapshotEdgeSignal(snapshot).action).toBe('candidate')
    expect(snapshotEdgeSignalBucket(snapshot)).toBe('candidate:strong')
    expect(inferSnapshotLiveDecision(snapshot).action).toBe('candidate_but_ineligible')
  })

  it('preserves stored quality and edge signals when present', () => {
    const snapshot = makeLegacySnapshot({
      quality: { tier: 'low', reason: 'stored', unsupported: false },
      edgeSignal: {
        available: true,
        side: 'teamA',
        strength: 'weak',
        action: 'watch_only',
        edgeVsLast: 0.04,
        reason: 'stored',
      },
    })

    expect(inferSnapshotQuality(snapshot).reason).toBe('stored')
    expect(snapshotEdgeSignalBucket(snapshot)).toBe('watch_only:weak')
  })
})
