import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { buildCoverageQualityReport } from './coverageQualityReport.js'

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function makeSnapshot(input: {
  capturedAt: string
  tourType?: string
  baselineSource?: string
  complete?: boolean
  integrity?: string
  serverSide?: 'teamA' | 'teamB' | null
  flashscoreStatsAvailable?: boolean
  kalshiStatsAvailable?: boolean
  prematchBaselineAvailable?: boolean
  marketStateAvailable?: boolean
  bid?: number | null
  ask?: number | null
  mid?: number | null
  last?: number | null
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
      tournamentName: 'Sample',
      round: 'R32',
      teamA: 'A',
      teamB: 'B',
      status: 'LIVE',
      abnormalReason: 'none',
      setIndex: 1,
      isTiebreak: false,
      setsWonA: 0,
      setsWonB: 0,
      currentSetGamesA: 2,
      currentSetGamesB: 2,
      currentGamePointsA: '15',
      currentGamePointsB: '15',
      serverSide: input.serverSide === undefined ? 'teamA' : input.serverSide,
      matchIntegrity: input.integrity ?? 'ok',
    },
    sourceCoverage: {
      flashscoreStatsAvailable: input.flashscoreStatsAvailable ?? true,
      kalshiStatsAvailable: input.kalshiStatsAvailable ?? true,
      prematchBaselineAvailable: input.prematchBaselineAvailable ?? true,
      marketStateAvailable: input.marketStateAvailable ?? true,
    },
    market: null,
    fairVsMarket: {
      available: true,
      marketTicker: 'mkt-1',
      marketStatus: 'OPEN',
      fairProbA: 0.5,
      fairProbB: 0.5,
      marketProbA: {
        bid: input.bid ?? null,
        ask: input.ask ?? 0.51,
        mid: input.mid ?? null,
        last: input.last ?? 0.5,
      },
      marketProbB: { bid: null, ask: null, mid: null, last: null },
      edgeA: { vsBid: null, vsAsk: null, vsMid: null, vsLast: null },
      edgeB: { vsBid: null, vsAsk: null, vsMid: null, vsLast: null },
    },
    stats: {
      resolved: {} as never,
      kalshiDisplay: null,
    },
    prematchBaseline: {
      source: input.baselineSource ?? 'tour_official',
      complete: input.complete ?? true,
      bestOf: 3,
      surface: 'hard',
      tourType: input.tourType ?? 'ATP',
      prematchFairProbA: 0.5,
      prematchFairProbB: 0.5,
      strengthBucketA: 'balanced',
      strengthBucketB: 'balanced',
      holdBaselineA: 0.8,
      holdBaselineB: 0.78,
      breakBaselineA: 0.2,
      breakBaselineB: 0.22,
    },
    risk: {
      level: 'low',
      machineCommand: 'OBSERVE',
      matchedRule: null,
      phase: 'non_tiebreak',
      stopTriggered: false,
    },
    pFair: {
      version: 'p-fair/v1',
      point: { serverSide: input.serverSide === undefined ? 'teamA' : input.serverSide, pPointA: 0.5, pPointB: 0.5, source: 'derived' },
      game: { serverSide: input.serverSide === undefined ? 'teamA' : input.serverSide, pGameA: 0.5, pGameB: 0.5, pHoldServer: 0.5, pBreakReceiver: 0.5, source: 'derived' },
      set: { pSetA: 0.5, pSetB: 0.5, source: 'derived' },
      match: { pMatchA: 0.5, pMatchB: 0.5, source: 'derived' },
      anchor: {
        prematchFairProbA: 0.5,
        prematchFairProbB: 0.5,
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
        integrity: input.integrity ?? 'ok',
        statsAdjustmentA: 0,
        statsAdjustmentB: 0,
      },
    },
    tradePlan: {
      tradeMode: 'watch',
      jumpPhase: false,
      exposureAllowed: false,
      preferredSide: 'none',
      summary: 'watch',
    },
  }
}

describe('buildCoverageQualityReport', () => {
  it('aggregates source coverage and quality by tour, baseline source, and integrity', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'tennis-coverage-quality-'))
    await writeJson(path.join(root, '2026/04/16/a.json'), makeSnapshot({ capturedAt: '2026-04-16T20:00:00.000Z', tourType: 'ATP', baselineSource: 'tour_official', complete: true, bid: 0.49, mid: 0.5 }))
    await writeJson(path.join(root, '2026/04/16/b.json'), makeSnapshot({ capturedAt: '2026-04-16T20:01:00.000Z', tourType: 'WTA', baselineSource: 'tour_official', complete: false, serverSide: null, integrity: 'serve_incomplete', bid: null, mid: null }))
    await writeJson(path.join(root, '2026/04/16/c.json'), makeSnapshot({ capturedAt: '2026-04-16T20:02:00.000Z', tourType: 'ITF', baselineSource: 'fallback', complete: true, kalshiStatsAvailable: false, marketStateAvailable: false, bid: null, ask: null, last: null, mid: null }))

    const report = await buildCoverageQualityReport(root)

    expect(report.version).toBe('coverage-quality-report/v1')
    expect(report.snapshotCount).toBe(3)
    expect(report.overall.officialBaselineRate).toBeCloseTo(2 / 3, 6)
    expect(report.overall.fallbackBaselineRate).toBeCloseTo(1 / 3, 6)
    expect(report.overall.serveAvailableRate).toBeCloseTo(2 / 3, 6)
    expect(report.overall.marketBidCoverage).toBeCloseTo(1 / 3, 6)
    expect(report.byTourType.find((bucket) => bucket.key === 'ITF')?.marketStateCoverage).toBe(0)
    expect(report.byBaselineSource.find((bucket) => bucket.key === 'tour_official')?.sampleCount).toBe(2)
    expect(report.byIntegrity.find((bucket) => bucket.key === 'serve_incomplete')?.serveAvailableRate).toBe(0)
  })

  it('handles empty snapshot roots', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'tennis-coverage-quality-empty-'))
    const report = await buildCoverageQualityReport(root)

    expect(report.snapshotCount).toBe(0)
    expect(report.overall.sampleCount).toBe(0)
    expect(report.overall.flashscoreStatsCoverage).toBe(0)
    expect(report.byTourType).toEqual([])
  })
})
