import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { buildCalibrationReport } from './calibrationReport.js'

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function makeSnapshot(input: {
  capturedAt: string
  tourType?: string
  phase?: string
  matchedRule?: string | null
  edgeVsMidA?: number | null
  edgeVsLastA?: number | null
  available?: boolean
  pFairA?: number
  setsWonA?: number
  setsWonB?: number
  status?: string
}) {
  return {
    version: 'decision-snapshot/v1',
    capturedAt: input.capturedAt,
    urls: {
      flashscoreMatchUrl: null,
      flashscoreSourcePageUrl: null,
      kalshiMarketUrl: null,
    },
    match: {
      matchId: 'evt-1',
      tournamentName: 'ATP Monte Carlo',
      round: 'Round of 32',
      teamA: 'A',
      teamB: 'B',
      status: input.status ?? 'LIVE',
      abnormalReason: 'none',
      setIndex: 2,
      isTiebreak: false,
      setsWonA: input.setsWonA ?? 1,
      setsWonB: input.setsWonB ?? 0,
      currentSetGamesA: 4,
      currentSetGamesB: 3,
      currentGamePointsA: '30',
      currentGamePointsB: '30',
      serverSide: 'teamA',
      matchIntegrity: 'ok',
    },
    sourceCoverage: {
      flashscoreStatsAvailable: true,
      kalshiStatsAvailable: true,
      prematchBaselineAvailable: true,
      marketStateAvailable: true,
    },
    quality: {
      tier: 'medium',
      reason: 'historical_baseline_live_stats',
      unsupported: false,
    },
    market: null,
    fairVsMarket: {
      available: input.available ?? true,
      marketTicker: 'mkt-1',
      marketStatus: 'OPEN',
      fairProbA: 0.61,
      fairProbB: 0.39,
      marketProbA: { bid: 0.57, ask: 0.59, mid: 0.58, last: 0.58 },
      marketProbB: { bid: 0.41, ask: 0.43, mid: 0.42, last: 0.42 },
      edgeA: {
        vsBid: 0.04,
        vsAsk: 0.02,
        vsMid: input.edgeVsMidA ?? 0.03,
        vsLast: input.edgeVsLastA ?? 0.03,
      },
      edgeB: {
        vsBid: -0.04,
        vsAsk: -0.02,
        vsMid: -0.03,
        vsLast: -0.03,
      },
    },
    edgeSignal: {
      available: true,
      side: 'teamA',
      strength: 'medium',
      action: 'candidate',
      edgeVsLast: input.edgeVsLastA ?? 0.03,
      reason: 'quality_adjusted_edge_candidate',
    },
    stats: {
      resolved: {} as never,
      kalshiDisplay: null,
    },
    prematchBaseline: {
      source: 'market',
      complete: true,
      bestOf: 3,
      surface: 'clay',
      tourType: input.tourType || 'ATP',
      prematchFairProbA: 0.61,
      prematchFairProbB: 0.39,
      strengthBucketA: 'favorite',
      strengthBucketB: 'underdog',
      holdBaselineA: 0.82,
      holdBaselineB: 0.78,
      breakBaselineA: 0.24,
      breakBaselineB: 0.19,
    },
    risk: {
      level: 'medium',
      machineCommand: 'WARN',
      matchedRule: input.matchedRule ?? '4-3 30-30 leader serving',
      phase: input.phase ?? 'non_tiebreak',
      stopTriggered: false,
    },
    pFair: {
      version: 'p-fair/v1',
      point: { serverSide: 'teamA', pPointA: 0.64, pPointB: 0.36, source: 'derived' },
      game: { serverSide: 'teamA', pGameA: 0.72, pGameB: 0.28, pHoldServer: 0.72, pBreakReceiver: 0.28, source: 'derived' },
      set: { pSetA: 0.66, pSetB: 0.34, source: 'derived' },
      match: { pMatchA: input.pFairA ?? 0.61, pMatchB: 1 - (input.pFairA ?? 0.61), source: 'derived' },
      anchor: {
        prematchFairProbA: 0.61,
        prematchFairProbB: 0.39,
        holdBaselineA: 0.82,
        holdBaselineB: 0.78,
        breakBaselineA: 0.24,
        breakBaselineB: 0.19,
      },
      diagnostics: {
        setIndex: 2,
        isTiebreak: false,
        pointScoreA: '30',
        pointScoreB: '30',
        gameScoreA: 4,
        gameScoreB: 3,
        riskRule: input.matchedRule ?? '4-3 30-30 leader serving',
        integrity: 'ok',
        statsAdjustmentA: 0.01,
        statsAdjustmentB: -0.01,
      },
    },
    tradePlan: {
      tradeMode: 'maker_reversion_light',
      jumpPhase: true,
      exposureAllowed: true,
      preferredSide: 'extreme_low_price_side',
      summary: 'jump',
    },
  }
}

describe('buildCalibrationReport', () => {
  it('aggregates snapshot edge statistics by tour, phase, and rule', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'tennis-calibration-'))
    await writeJson(path.join(root, '2026/04/14/a.json'), makeSnapshot({ capturedAt: '2026-04-14T20:00:00.000Z', tourType: 'ATP', edgeVsMidA: 0.03 }))
    await writeJson(path.join(root, '2026/04/14/b.json'), makeSnapshot({ capturedAt: '2026-04-14T20:01:00.000Z', tourType: 'ATP', edgeVsMidA: 0.01 }))
    await writeJson(path.join(root, '2026/04/14/c.json'), makeSnapshot({ capturedAt: '2026-04-14T20:02:00.000Z', tourType: 'WTA', phase: 'tiebreak', matchedRule: 'TB 4-4', edgeVsMidA: -0.02, edgeVsLastA: -0.01 }))

    const report = await buildCalibrationReport(root)

    expect(report.version).toBe('calibration-report/v1')
    expect(report.snapshotCount).toBe(3)
    expect(report.usableCount).toBe(3)
    expect(report.overall.meanEdgeVsMidA).toBeCloseTo(0.0066666667, 6)
    expect(report.byTourType[0]?.key).toBe('ATP')
    expect(report.byTourType[0]?.sampleCount).toBe(2)
    expect(report.byQualityTier.find((bucket) => bucket.key === 'medium')?.sampleCount).toBe(3)
    expect(report.byEdgeSignal.find((bucket) => bucket.key === 'candidate:medium')?.sampleCount).toBe(3)
    expect(report.byPhase.find((bucket) => bucket.key === 'tiebreak')?.sampleCount).toBe(1)
    expect(report.byMatchedRule.find((bucket) => bucket.key === 'TB 4-4')?.meanEdgeVsLastA).toBeCloseTo(-0.01, 6)
  })

  it('computes resolved calibration metrics from final snapshots', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'tennis-calibration-resolved-'))
    await writeJson(path.join(root, 'a.json'), makeSnapshot({ capturedAt: '2026-04-14T20:00:00.000Z', status: 'FINAL', setsWonA: 2, setsWonB: 0, pFairA: 0.7 }))
    await writeJson(path.join(root, 'b.json'), makeSnapshot({ capturedAt: '2026-04-14T20:01:00.000Z', status: 'FINAL', setsWonA: 0, setsWonB: 2, pFairA: 0.7 }))

    const report = await buildCalibrationReport(root)

    expect(report.overall.resolvedCount).toBe(2)
    expect(report.overall.meanPFairA).toBeCloseTo(0.7, 6)
    expect(report.overall.winRateA).toBeCloseTo(0.5, 6)
    expect(report.overall.brierScoreA).toBeCloseTo(((0.7 - 1) ** 2 + (0.7 - 0) ** 2) / 2, 6)
    expect(report.byPFairBucket.find((bucket) => bucket.key === '0.7-0.8')?.resolvedCount).toBe(2)
  })

  it('uses resolved outcome sidecars for live snapshots', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'tennis-calibration-live-'))
    const outcomeRoot = await mkdtemp(path.join(os.tmpdir(), 'tennis-calibration-outcomes-'))
    const snapshot = makeSnapshot({ capturedAt: '2026-04-14T20:00:00.000Z', status: 'LIVE', pFairA: 0.8 })
    snapshot.urls.flashscoreMatchUrl = 'https://www.flashscore.com/match/tennis/a/b/'
    snapshot.match.matchId = 'evt-1'
    await writeJson(path.join(root, 'a.json'), snapshot)
    await writeJson(path.join(outcomeRoot, 'outcome.json'), {
      version: 'resolved-match-outcome/v1',
      resolvedAt: '2026-04-14T23:00:00.000Z',
      source: 'flashscore',
      matchId: 'evt-1',
      flashscoreMatchUrl: 'https://www.flashscore.com/match/tennis/a/b/',
      teamA: 'A',
      teamB: 'B',
      status: 'FINAL',
      setsWonA: 0,
      setsWonB: 2,
      winner: 'teamB',
      confidence: 'high',
      reason: 'final_score_sets',
    })

    const report = await buildCalibrationReport(root, { outcomeRootDir: outcomeRoot })

    expect(report.overall.resolvedCount).toBe(1)
    expect(report.overall.winRateA).toBe(0)
    expect(report.overall.brierScoreA).toBeCloseTo(0.64, 6)
  })

  it('infers quality and edge signal buckets for legacy snapshots', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'tennis-calibration-legacy-'))
    const snapshot = makeSnapshot({ capturedAt: '2026-04-14T20:00:00.000Z', edgeVsLastA: 0.12 })
    delete (snapshot as Partial<ReturnType<typeof makeSnapshot>>).quality
    delete (snapshot as Partial<ReturnType<typeof makeSnapshot>>).edgeSignal
    await writeJson(path.join(root, 'legacy.json'), snapshot)

    const report = await buildCalibrationReport(root)

    expect(report.byQualityTier.find((bucket) => bucket.key === 'low')?.sampleCount).toBe(1)
    expect(report.byEdgeSignal.find((bucket) => bucket.key === 'watch_only:strong')?.sampleCount).toBe(1)
  })

  it('handles missing or empty snapshot directories', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'tennis-calibration-empty-'))
    const report = await buildCalibrationReport(root)

    expect(report.snapshotCount).toBe(0)
    expect(report.usableCount).toBe(0)
    expect(report.overall.sampleCount).toBe(0)
    expect(report.overall.meanEdgeVsMidA).toBeNull()
  })
})
