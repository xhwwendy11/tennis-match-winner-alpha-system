import { findResolvedOutcome, loadResolvedOutcomeIndex, type ResolvedMatchOutcome } from './resolvedOutcome.js'
import { loadDecisionSnapshots } from './calibrationReport.js'
import type { DecisionSnapshot } from './decisionSnapshot.js'
import { inferSnapshotLiveDecision, inferSnapshotQualityTier } from './snapshotReportEnrichment.js'

export interface TourSegmentSummary {
  key: string
  sampleCount: number
  usableCount: number
  resolvedCount: number
  candidateCount: number
  blockedCandidateCount: number
  mediumHighCount: number
  watchOnlyCount: number
  ignoreCount: number
  meanPFairA: number | null
  winRateA: number | null
  brierScoreA: number | null
  logLossA: number | null
  meanEdgeVsLastA: number | null
  meanAbsEdgeVsLastA: number | null
  qualityCounts: Record<string, number>
  edgeActionCounts: Record<string, number>
  baselineSourceCounts: Record<string, number>
}

export interface TourSegmentationReport {
  version: 'tour-segmentation-report/v1'
  generatedAt: string
  snapshotCount: number
  usableCount: number
  segments: TourSegmentSummary[]
}

function mean(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function bucketizeCounts(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] || 0) + 1
    return acc
  }, {})
}

function resolvedWinnerA(snapshot: DecisionSnapshot): 0 | 1 | null {
  if (snapshot.match.status !== 'FINAL') return null
  const setsA = snapshot.match.setsWonA
  const setsB = snapshot.match.setsWonB
  if (typeof setsA !== 'number' || typeof setsB !== 'number' || setsA === setsB) return null
  return setsA > setsB ? 1 : 0
}

function resolvedWinnerAWithOutcome(
  snapshot: DecisionSnapshot,
  outcomeIndex?: Map<string, ResolvedMatchOutcome>,
): 0 | 1 | null {
  const snapshotWinner = resolvedWinnerA(snapshot)
  if (snapshotWinner != null) return snapshotWinner
  if (!outcomeIndex) return null

  const outcome = findResolvedOutcome(outcomeIndex, {
    matchId: snapshot.match.matchId,
    flashscoreMatchUrl: snapshot.urls.flashscoreMatchUrl,
  })
  if (!outcome || outcome.status !== 'FINAL') return null
  if (outcome.winner === 'teamA') return 1
  if (outcome.winner === 'teamB') return 0
  return null
}

function segmentKey(snapshot: DecisionSnapshot): string {
  const tourType = snapshot.prematchBaseline?.tourType || 'UNKNOWN'
  const gender = snapshot.match.gender || 'unknown'
  if (tourType === 'ITF') return gender === 'women' ? 'ITF_WOMEN' : gender === 'men' ? 'ITF_MEN' : 'ITF'
  return tourType
}

function toSegmentSummary(
  key: string,
  snapshots: DecisionSnapshot[],
  outcomeIndex?: Map<string, ResolvedMatchOutcome>,
): TourSegmentSummary {
  const usable = snapshots.filter((snapshot) => snapshot.fairVsMarket.available)
  const qualityTiers = usable.map(inferSnapshotQualityTier)
  const edgeActions = usable.map((snapshot) => inferSnapshotLiveDecision(snapshot).action || 'unknown')
  const baselineSources = usable.map((snapshot) => snapshot.prematchBaseline?.source || 'none')
  const resolved = usable
    .map((snapshot) => {
      const y = resolvedWinnerAWithOutcome(snapshot, outcomeIndex)
      const p = snapshot.pFair.match.pMatchA
      if (y == null || typeof p !== 'number' || !Number.isFinite(p)) return null
      return { y, p: clamp(p, 0.000001, 0.999999) }
    })
    .filter((value): value is { y: 0 | 1; p: number } => value != null)

  const edgeVsLast = usable
    .map((snapshot) => snapshot.fairVsMarket.edgeA.vsLast)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  const edgeActionCounts = bucketizeCounts(edgeActions)

  return {
    key,
    sampleCount: snapshots.length,
    usableCount: usable.length,
    resolvedCount: resolved.length,
    candidateCount: edgeActionCounts.candidate || 0,
    blockedCandidateCount: edgeActionCounts.candidate_but_ineligible || 0,
    mediumHighCount: qualityTiers.filter((value) => value === 'medium' || value === 'high').length,
    watchOnlyCount: edgeActionCounts.watch_only || 0,
    ignoreCount: edgeActionCounts.ignore || 0,
    meanPFairA: mean(resolved.map((value) => value.p)),
    winRateA: mean(resolved.map((value) => value.y)),
    brierScoreA: mean(resolved.map((value) => (value.p - value.y) ** 2)),
    logLossA: mean(resolved.map((value) => -(value.y * Math.log(value.p) + (1 - value.y) * Math.log(1 - value.p)))),
    meanEdgeVsLastA: mean(edgeVsLast),
    meanAbsEdgeVsLastA: mean(edgeVsLast.map((value) => Math.abs(value))),
    qualityCounts: bucketizeCounts(qualityTiers),
    edgeActionCounts,
    baselineSourceCounts: bucketizeCounts(baselineSources),
  }
}

export async function buildTourSegmentationReport(
  rootDir: string,
  options: { outcomeRootDir?: string | null } = {},
): Promise<TourSegmentationReport> {
  const snapshots = await loadDecisionSnapshots(rootDir)
  const outcomeIndex = options.outcomeRootDir ? await loadResolvedOutcomeIndex(options.outcomeRootDir) : undefined
  const buckets = new Map<string, DecisionSnapshot[]>()

  for (const snapshot of snapshots) {
    const key = segmentKey(snapshot)
    const group = buckets.get(key)
    if (group) group.push(snapshot)
    else buckets.set(key, [snapshot])
  }

  const segments = [...buckets.entries()]
    .map(([key, group]) => toSegmentSummary(key, group, outcomeIndex))
    .sort((a, b) => b.sampleCount - a.sampleCount || a.key.localeCompare(b.key))

  return {
    version: 'tour-segmentation-report/v1',
    generatedAt: new Date().toISOString(),
    snapshotCount: snapshots.length,
    usableCount: snapshots.filter((snapshot) => snapshot.fairVsMarket.available).length,
    segments,
  }
}
