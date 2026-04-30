import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { buildTourSegmentationReport } from './tourSegmentationReport.js'

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function makeSnapshot(input: {
  capturedAt: string
  matchId: string
  tourType?: string
  gender?: string
  quality?: string
  edgeAction?: string
  liveDecisionAction?: string
  baselineSource?: string
  pFairA?: number
  status?: string
  setsWonA?: number
  setsWonB?: number
  fairAvailable?: boolean
  edgeVsLastA?: number
}) {
  return {
    version: 'decision-snapshot/v1',
    capturedAt: input.capturedAt,
    urls: {
      flashscoreMatchUrl: `https://www.flashscore.com/match/${input.matchId}`,
      flashscoreSourcePageUrl: null,
      kalshiMarketUrl: null,
    },
    match: {
      matchId: input.matchId,
      tournamentName: 'Test',
      round: 'R32',
      gender: input.gender ?? 'men',
      discipline: 'singles',
      teamA: 'A',
      teamB: 'B',
      status: input.status ?? 'LIVE',
      abnormalReason: 'none',
      setIndex: 1,
      isTiebreak: false,
      setsWonA: input.setsWonA ?? 0,
      setsWonB: input.setsWonB ?? 0,
      currentSetGamesA: 3,
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
      tier: input.quality ?? 'high',
      reason: 'test',
      unsupported: false,
    },
    market: null,
    fairVsMarket: {
      available: input.fairAvailable ?? true,
      marketTicker: 'mkt',
      marketStatus: 'OPEN',
      fairProbA: input.pFairA ?? 0.6,
      fairProbB: 1 - (input.pFairA ?? 0.6),
      marketProbA: { bid: null, ask: 0.6, mid: null, last: 0.55 },
      marketProbB: { bid: null, ask: 0.4, mid: null, last: 0.45 },
      edgeA: { vsBid: null, vsAsk: 0, vsMid: null, vsLast: input.edgeVsLastA ?? 0.05 },
      edgeB: { vsBid: null, vsAsk: 0, vsMid: null, vsLast: -(input.edgeVsLastA ?? 0.05) },
    },
    edgeSignal: {
      available: true,
      side: 'teamA',
      strength: 'strong',
      action: input.edgeAction ?? 'candidate',
      edgeVsLast: input.edgeVsLastA ?? 0.05,
      reason: 'test',
    },
    marketEligibility: {
      eligible: (input.liveDecisionAction ?? input.edgeAction ?? 'candidate') !== 'candidate_but_ineligible',
      reasons: (input.liveDecisionAction ?? input.edgeAction ?? 'candidate') === 'candidate_but_ineligible' ? ['low_volume'] : [],
      metrics: {
        volume: 600000,
        marketStatus: 'OPEN',
        marketProbALast: 0.55,
        marketProbBLast: 0.45,
        marketProbAAsk: 0.6,
        marketProbBAsk: 0.4,
        askOverround: 0,
        marketAgeSeconds: 8,
      },
      rule: {
        requireOpen: true,
        requireFairComparison: true,
        requireLastPrice: true,
        requireTwoSidedAsk: true,
        minVolume: 500000,
        maxAskOverround: 0.02,
        maxMarketAgeSeconds: 10,
      },
    },
    liveDecision: {
      action: input.liveDecisionAction ?? input.edgeAction ?? 'candidate',
      side: 'teamA',
      strength: 'strong',
      edgeVsLast: input.edgeVsLastA ?? 0.05,
      marketEligible: (input.liveDecisionAction ?? input.edgeAction ?? 'candidate') !== 'candidate_but_ineligible',
      reason: 'test',
      blockedBy: (input.liveDecisionAction ?? input.edgeAction ?? 'candidate') === 'candidate_but_ineligible' ? ['low_volume'] : [],
    },
    stats: {
      resolved: {} as never,
      kalshiDisplay: null,
    },
    prematchBaseline: {
      source: input.baselineSource ?? 'tour_official',
      complete: true,
      bestOf: 3,
      surface: 'hard',
      tourType: input.tourType ?? 'ATP',
      prematchFairProbA: null,
      prematchFairProbB: null,
      strengthBucketA: 'unknown',
      strengthBucketB: 'unknown',
      holdBaselineA: 0.8,
      holdBaselineB: 0.78,
      breakBaselineA: 0.22,
      breakBaselineB: 0.2,
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
      point: { serverSide: 'teamA', pPointA: 0.6, pPointB: 0.4, source: 'derived' },
      game: { serverSide: 'teamA', pGameA: 0.6, pGameB: 0.4, pHoldServer: 0.6, pBreakReceiver: 0.4, source: 'derived' },
      set: { pSetA: 0.6, pSetB: 0.4, source: 'derived' },
      match: { pMatchA: input.pFairA ?? 0.6, pMatchB: 1 - (input.pFairA ?? 0.6), source: 'derived' },
      anchor: {
        prematchFairProbA: null,
        prematchFairProbB: null,
        holdBaselineA: 0.8,
        holdBaselineB: 0.78,
        breakBaselineA: 0.22,
        breakBaselineB: 0.2,
      },
      diagnostics: {
        setIndex: 1,
        isTiebreak: false,
        pointScoreA: '30',
        pointScoreB: '30',
        gameScoreA: 3,
        gameScoreB: 3,
        riskRule: 'fallback',
        integrity: 'ok',
        statsAdjustmentA: 0,
        statsAdjustmentB: 0,
      },
    },
    tradePlan: null,
  }
}

describe('buildTourSegmentationReport', () => {
  it('segments snapshots by tour and splits ITF by gender', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'tennis-tour-segments-'))
    await writeJson(path.join(root, 'a.json'), makeSnapshot({ capturedAt: '2026-04-14T20:00:00.000Z', matchId: 'a', tourType: 'ATP', pFairA: 0.7, status: 'FINAL', setsWonA: 2, setsWonB: 0 }))
    await writeJson(path.join(root, 'b.json'), makeSnapshot({ capturedAt: '2026-04-14T20:01:00.000Z', matchId: 'b', tourType: 'ATP_CHALLENGER', quality: 'low', edgeAction: 'candidate', liveDecisionAction: 'candidate_but_ineligible' }))
    await writeJson(path.join(root, 'c.json'), makeSnapshot({ capturedAt: '2026-04-14T20:02:00.000Z', matchId: 'c', tourType: 'ITF', gender: 'women', baselineSource: 'flashscore_history' }))
    await writeJson(path.join(root, 'd.json'), makeSnapshot({ capturedAt: '2026-04-14T20:03:00.000Z', matchId: 'd', tourType: 'ITF', gender: 'men', fairAvailable: false }))

    const report = await buildTourSegmentationReport(root)

    expect(report.version).toBe('tour-segmentation-report/v1')
    expect(report.snapshotCount).toBe(4)
    expect(report.usableCount).toBe(3)
    expect(report.segments.find((segment) => segment.key === 'ATP')?.resolvedCount).toBe(1)
    expect(report.segments.find((segment) => segment.key === 'ATP')?.candidateCount).toBe(1)
    expect(report.segments.find((segment) => segment.key === 'ATP_CHALLENGER')?.blockedCandidateCount).toBe(1)
    expect(report.segments.find((segment) => segment.key === 'ATP_CHALLENGER')?.watchOnlyCount).toBe(0)
    expect(report.segments.find((segment) => segment.key === 'ITF_WOMEN')?.baselineSourceCounts.flashscore_history).toBe(1)
    expect(report.segments.find((segment) => segment.key === 'ITF_MEN')?.usableCount).toBe(0)
  })
})
