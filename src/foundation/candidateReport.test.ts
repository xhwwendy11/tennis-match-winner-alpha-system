import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { buildCandidateReport } from './candidateReport.js'

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

function makeSnapshot(input: {
  capturedAt: string
  matchId: string
  tourType?: string
  quality?: string
  action?: string
  liveDecisionAction?: string
  marketEligible?: boolean
  marketEligibilityReasons?: string[]
  edgeVsLastA?: number
  pFairA?: number
  status?: string
  setsWonA?: number
  setsWonB?: number
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
      gender: 'men',
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
      available: true,
      marketTicker: 'mkt',
      marketStatus: 'OPEN',
      fairProbA: input.pFairA ?? 0.7,
      fairProbB: 1 - (input.pFairA ?? 0.7),
      marketProbA: { bid: null, ask: 0.6, mid: null, last: 0.55 },
      marketProbB: { bid: null, ask: 0.4, mid: null, last: 0.45 },
      edgeA: { vsBid: null, vsAsk: 0.1, vsMid: null, vsLast: input.edgeVsLastA ?? 0.12 },
      edgeB: { vsBid: null, vsAsk: -0.1, vsMid: null, vsLast: -(input.edgeVsLastA ?? 0.12) },
    },
    marketEligibility: {
      eligible: input.marketEligible ?? true,
      reasons: input.marketEligibilityReasons ?? [],
      metrics: {
        volume: 150000,
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
        minVolume: 10000,
        maxAskOverround: 0.12,
        maxMarketAgeSeconds: 10,
      },
    },
    edgeSignal: {
      available: true,
      side: 'teamA',
      strength: 'strong',
      action: input.action ?? 'candidate',
      edgeVsLast: input.edgeVsLastA ?? 0.12,
      reason: 'test',
    },
    liveDecision: {
      action: input.liveDecisionAction ?? input.action ?? 'candidate',
      side: 'teamA',
      strength: 'strong',
      edgeVsLast: input.edgeVsLastA ?? 0.12,
      marketEligible: input.marketEligible ?? true,
      reason: 'test',
      blockedBy: input.marketEligibilityReasons ?? [],
    },
    stats: {
      resolved: {} as never,
      kalshiDisplay: null,
    },
    prematchBaseline: {
      source: 'tour_official',
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
      match: { pMatchA: input.pFairA ?? 0.7, pMatchB: 1 - (input.pFairA ?? 0.7), source: 'derived' },
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

describe('buildCandidateReport', () => {
  it('reports only candidate snapshots and resolved performance', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'tennis-candidate-report-'))
    await writeJson(path.join(root, 'a.json'), makeSnapshot({ capturedAt: '2026-04-14T20:00:00.000Z', matchId: 'a', tourType: 'ATP', status: 'FINAL', setsWonA: 2, setsWonB: 0, pFairA: 0.7 }))
    await writeJson(path.join(root, 'b.json'), makeSnapshot({
      capturedAt: '2026-04-14T20:01:00.000Z',
      matchId: 'b',
      tourType: 'ATP_CHALLENGER',
      status: 'FINAL',
      setsWonA: 0,
      setsWonB: 2,
      pFairA: 0.8,
      quality: 'medium',
      marketEligible: false,
      marketEligibilityReasons: ['low_volume'],
      liveDecisionAction: 'candidate_but_ineligible',
    }))
    await writeJson(path.join(root, 'c.json'), makeSnapshot({ capturedAt: '2026-04-14T20:02:00.000Z', matchId: 'c', action: 'watch_only' }))

    const report = await buildCandidateReport(root)

    expect(report.version).toBe('candidate-report/v1')
    expect(report.snapshotCount).toBe(3)
    expect(report.candidateCount).toBe(2)
    expect(report.directCandidateCount).toBe(1)
    expect(report.blockedCandidateCount).toBe(1)
    expect(report.resolvedCandidateCount).toBe(2)
    expect(report.overall.sampleCount).toBe(2)
    expect(report.directCandidateOnly.sampleCount).toBe(1)
    expect(report.blockedCandidateOnly.sampleCount).toBe(1)
    expect(report.eligibleOnly.sampleCount).toBe(1)
    expect(report.ineligibleOnly.sampleCount).toBe(1)
    expect(report.highQualityOnly.sampleCount).toBe(1)
    expect(report.mediumQualityOnly.sampleCount).toBe(1)
    expect(report.byLiveDecision.find((bucket) => bucket.key === 'candidate')?.sampleCount).toBe(1)
    expect(report.byLiveDecision.find((bucket) => bucket.key === 'candidate_but_ineligible')?.sampleCount).toBe(1)
    expect(report.byEligibility.find((bucket) => bucket.key === 'eligible')?.sampleCount).toBe(1)
    expect(report.byEligibility.find((bucket) => bucket.key === 'ineligible')?.sampleCount).toBe(1)
    expect(report.byTourType.find((bucket) => bucket.key === 'ATP')?.resolvedCount).toBe(1)
    expect(report.byQualityTier.find((bucket) => bucket.key === 'medium')?.sampleCount).toBe(1)
    expect(report.resolvedCandidates).toHaveLength(2)
    expect(report.resolvedCandidates[0]?.correct).toBe(true)
    expect(report.resolvedCandidates[0]?.marketEligible).toBe(true)
    expect(report.resolvedCandidates[1]?.correct).toBe(false)
    expect(report.resolvedCandidates[1]?.marketEligibilityReasons).toEqual(['low_volume'])
  })
})
