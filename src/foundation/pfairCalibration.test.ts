import { describe, expect, it } from 'vitest'

import type { DecisionSnapshot } from './decisionSnapshot.js'
import {
  buildPFairCalibrationModel,
  buildPFairCalibrationReport,
  calibratePFairA,
  pFairBucketFromValue,
} from './pfairCalibration.js'

function makeSnapshot(input: { pFairA: number; winnerA: boolean; tourType?: string; source?: string }): DecisionSnapshot {
  return {
    version: 'decision-snapshot/v1',
    capturedAt: '2026-04-22T20:00:00.000Z',
    urls: {
      flashscoreMatchUrl: null,
      flashscoreSourcePageUrl: null,
      kalshiMarketUrl: null,
    },
    match: {
      matchId: 'm',
      tournamentName: 'ATP Example',
      round: 'Round of 32',
      gender: 'men',
      discipline: 'singles',
      teamA: 'A',
      teamB: 'B',
      status: 'FINAL',
      abnormalReason: 'none',
      setIndex: 2,
      isTiebreak: false,
      setsWonA: input.winnerA ? 2 : 0,
      setsWonB: input.winnerA ? 0 : 2,
      currentSetGamesA: null,
      currentSetGamesB: null,
      currentGamePointsA: null,
      currentGamePointsB: null,
      serverSide: null,
      matchIntegrity: 'ok',
    },
    sourceCoverage: {
      flashscoreStatsAvailable: true,
      kalshiStatsAvailable: true,
      prematchBaselineAvailable: true,
      marketStateAvailable: true,
    },
    quality: {
      tier: 'high',
      reason: 'official_baseline_live_stats',
      unsupported: false,
    },
    market: null,
    fairVsMarket: {
      available: true,
      marketTicker: 'mkt',
      marketStatus: 'SETTLED',
      marketYesSide: 'teamA',
      fairProbA: input.pFairA,
      fairProbB: 1 - input.pFairA,
      marketProbA: { bid: null, ask: 0.5, mid: null, last: 0.5 },
      marketProbB: { bid: null, ask: 0.5, mid: null, last: 0.5 },
      edgeA: { vsBid: null, vsAsk: input.pFairA - 0.5, vsMid: null, vsLast: input.pFairA - 0.5 },
      edgeB: { vsBid: null, vsAsk: 0.5 - input.pFairA, vsMid: null, vsLast: 0.5 - input.pFairA },
    },
    edgeSignal: {
      available: true,
      side: 'teamA',
      strength: 'medium',
      action: 'candidate',
      edgeVsLast: input.pFairA - 0.5,
      reason: 'quality_adjusted_edge_candidate',
    },
    stats: {
      resolved: {} as never,
      kalshiDisplay: null,
    },
    prematchBaseline: {
      source: input.source || 'tour_official',
      complete: true,
      bestOf: 3,
      surface: null,
      tourType: input.tourType || 'ATP',
      prematchFairProbA: 0.5,
      prematchFairProbB: 0.5,
      strengthBucketA: 'even',
      strengthBucketB: 'even',
      holdBaselineA: 0.8,
      holdBaselineB: 0.8,
      breakBaselineA: 0.2,
      breakBaselineB: 0.2,
    },
    risk: {
      level: 'low',
      machineCommand: 'OK',
      matchedRule: 'fallback',
      phase: 'non_tiebreak',
      stopTriggered: false,
    },
    pFair: {
      version: 'p-fair/v1',
      point: { serverSide: 'teamA', pPointA: 0.6, pPointB: 0.4, source: 'derived' },
      game: { serverSide: 'teamA', pGameA: 0.7, pGameB: 0.3, pHoldServer: 0.7, pBreakReceiver: 0.3, source: 'derived' },
      set: { pSetA: input.pFairA, pSetB: 1 - input.pFairA, source: 'derived' },
      match: { pMatchA: input.pFairA, pMatchB: 1 - input.pFairA, source: 'derived' },
      anchor: {
        prematchFairProbA: 0.5,
        prematchFairProbB: 0.5,
        holdBaselineA: 0.8,
        holdBaselineB: 0.8,
        breakBaselineA: 0.2,
        breakBaselineB: 0.2,
      },
      diagnostics: {
        setIndex: 1,
        isTiebreak: false,
        pointScoreA: '0',
        pointScoreB: '0',
        gameScoreA: 0,
        gameScoreB: 0,
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
  }
}

describe('pFairCalibration', () => {
  it('bucketizes pFair values', () => {
    expect(pFairBucketFromValue(0)).toBe('0.0-0.1')
    expect(pFairBucketFromValue(0.71)).toBe('0.7-0.8')
    expect(pFairBucketFromValue(0.999)).toBe('0.9-1.0')
    expect(pFairBucketFromValue(null)).toBe('unknown')
  })

  it('learns conservative adjustments from resolved bucket bias', () => {
    const snapshots = [
      makeSnapshot({ pFairA: 0.7, winnerA: true }),
      makeSnapshot({ pFairA: 0.7, winnerA: false }),
      makeSnapshot({ pFairA: 0.7, winnerA: false }),
      makeSnapshot({ pFairA: 0.7, winnerA: false }),
    ]

    const model = buildPFairCalibrationModel(snapshots, { priorStrength: 4, maxAdjustment: 0.2 })
    const rule = model.byPFairBucket.find((candidate) => candidate.key === '0.7-0.8')

    expect(rule?.winRateA).toBe(0.25)
    expect(rule?.rawBiasA).toBeCloseTo(-0.45, 6)
    expect(rule?.adjustmentA).toBeCloseTo(-0.225 > -0.2 ? -0.225 : -0.2, 6)
    expect(calibratePFairA(0.7, model)).toBeCloseTo(0.5, 6)
  })

  it('reports raw and calibrated metrics without mutating snapshots', async () => {
    const snapshots = [
      makeSnapshot({ pFairA: 0.7, winnerA: true, tourType: 'ATP' }),
      makeSnapshot({ pFairA: 0.7, winnerA: false, tourType: 'ATP' }),
      makeSnapshot({ pFairA: 0.7, winnerA: false, tourType: 'WTA' }),
      makeSnapshot({ pFairA: 0.2, winnerA: false, tourType: 'WTA', source: 'fallback' }),
    ]

    const report = await buildPFairCalibrationReport({
      snapshots,
      config: { priorStrength: 4, maxAdjustment: 0.2 },
    })

    expect(report.version).toBe('p-fair-calibration-report/v1')
    expect(report.resolvedCount).toBe(4)
    expect(report.overall.calibratedBrierScoreA).toBeLessThanOrEqual(report.overall.rawBrierScoreA!)
    expect(report.byTourType.find((bucket) => bucket.key === 'ATP')?.sampleCount).toBe(2)
    expect(snapshots[0]?.pFair.match.pMatchA).toBe(0.7)
  })

  it('ignores undefined config overrides', async () => {
    const report = await buildPFairCalibrationReport({
      snapshots: [
        makeSnapshot({ pFairA: 0.7, winnerA: true }),
        makeSnapshot({ pFairA: 0.7, winnerA: false }),
      ],
      config: { priorStrength: undefined, maxAdjustment: undefined },
    })

    expect(report.model.config.priorStrength).toBe(20)
    expect(report.model.config.maxAdjustment).toBe(0.12)
    expect(report.overall.meanCalibratedPFairA).toBeTypeOf('number')
  })
})
