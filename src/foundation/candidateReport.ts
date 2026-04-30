import { findResolvedOutcome, loadResolvedOutcomeIndex, type ResolvedMatchOutcome } from './resolvedOutcome.js'
import { loadDecisionSnapshots } from './calibrationReport.js'
import type { DecisionSnapshot } from './decisionSnapshot.js'
import { buildMarketEligibility } from './marketEligibility.js'
import { inferSnapshotEdgeSignal, inferSnapshotLiveDecision, inferSnapshotQualityTier } from './snapshotReportEnrichment.js'

export interface CandidateBucket {
  key: string
  sampleCount: number
  resolvedCount: number
  winRateA: number | null
  meanPFairA: number | null
  brierScoreA: number | null
  logLossA: number | null
  meanEdgeVsLastA: number | null
  meanAbsEdgeVsLastA: number | null
}

export interface CandidateResolvedRow {
  capturedAt: string
  tourType: string
  qualityTier: string
  marketEligible: boolean
  marketEligibilityReasons: string[]
  matchId: string | null
  teamA: string | null
  teamB: string | null
  pFairA: number
  marketLastA: number | null
  edgeVsLastA: number | null
  winner: 'teamA' | 'teamB'
  correct: boolean
}

export interface CandidateReport {
  version: 'candidate-report/v1'
  generatedAt: string
  snapshotCount: number
  candidateCount: number
  directCandidateCount: number
  blockedCandidateCount: number
  resolvedCandidateCount: number
  overall: CandidateBucket
  directCandidateOnly: CandidateBucket
  blockedCandidateOnly: CandidateBucket
  eligibleOnly: CandidateBucket
  ineligibleOnly: CandidateBucket
  highQualityOnly: CandidateBucket
  mediumQualityOnly: CandidateBucket
  byLiveDecision: CandidateBucket[]
  byEligibility: CandidateBucket[]
  byTourType: CandidateBucket[]
  byQualityTier: CandidateBucket[]
  byEdgeBucket: CandidateBucket[]
  resolvedCandidates: CandidateResolvedRow[]
}

function mean(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function resolvedWinner(snapshot: DecisionSnapshot): 'teamA' | 'teamB' | null {
  if (snapshot.match.status !== 'FINAL') return null
  const setsA = snapshot.match.setsWonA
  const setsB = snapshot.match.setsWonB
  if (typeof setsA !== 'number' || typeof setsB !== 'number' || setsA === setsB) return null
  return setsA > setsB ? 'teamA' : 'teamB'
}

function resolvedWinnerWithOutcome(
  snapshot: DecisionSnapshot,
  outcomeIndex?: Map<string, ResolvedMatchOutcome>,
): 'teamA' | 'teamB' | null {
  const snapshotWinner = resolvedWinner(snapshot)
  if (snapshotWinner) return snapshotWinner
  if (!outcomeIndex) return null

  const outcome = findResolvedOutcome(outcomeIndex, {
    matchId: snapshot.match.matchId,
    flashscoreMatchUrl: snapshot.urls.flashscoreMatchUrl,
  })
  if (!outcome || outcome.status !== 'FINAL') return null
  return outcome.winner
}

function edgeBucket(snapshot: DecisionSnapshot): string {
  const edge = Math.abs(inferSnapshotEdgeSignal(snapshot).edgeVsLast || 0)
  if (edge < 0.06) return '0.03-0.06'
  if (edge < 0.1) return '0.06-0.10'
  if (edge < 0.2) return '0.10-0.20'
  return '0.20+'
}

function effectiveMarketEligibility(snapshot: DecisionSnapshot) {
  return snapshot.marketEligibility || buildMarketEligibility({
    marketState: snapshot.market,
    fairVsMarket: snapshot.fairVsMarket,
    capturedAt: snapshot.capturedAt,
  })
}

function toBucket(
  key: string,
  entries: DecisionSnapshot[],
  outcomeIndex?: Map<string, ResolvedMatchOutcome>,
): CandidateBucket {
  const resolved = entries
    .map((snapshot) => {
      const winner = resolvedWinnerWithOutcome(snapshot, outcomeIndex)
      const p = snapshot.pFair.match.pMatchA
      if (!winner || typeof p !== 'number' || !Number.isFinite(p)) return null
      return { y: winner === 'teamA' ? 1 : 0, p: clamp(p, 0.000001, 0.999999) }
    })
    .filter((value): value is { y: 0 | 1; p: number } => value != null)

  const edgeVsLastA = entries
    .map((snapshot) => snapshot.fairVsMarket.edgeA.vsLast)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  return {
    key,
    sampleCount: entries.length,
    resolvedCount: resolved.length,
    winRateA: mean(resolved.map((value) => value.y)),
    meanPFairA: mean(resolved.map((value) => value.p)),
    brierScoreA: mean(resolved.map((value) => (value.p - value.y) ** 2)),
    logLossA: mean(resolved.map((value) => -(value.y * Math.log(value.p) + (1 - value.y) * Math.log(1 - value.p)))),
    meanEdgeVsLastA: mean(edgeVsLastA),
    meanAbsEdgeVsLastA: mean(edgeVsLastA.map((value) => Math.abs(value))),
  }
}

function bucketize(
  entries: DecisionSnapshot[],
  keyFn: (snapshot: DecisionSnapshot) => string,
  outcomeIndex?: Map<string, ResolvedMatchOutcome>,
): CandidateBucket[] {
  const buckets = new Map<string, DecisionSnapshot[]>()
  for (const snapshot of entries) {
    const key = keyFn(snapshot)
    const group = buckets.get(key)
    if (group) group.push(snapshot)
    else buckets.set(key, [snapshot])
  }

  return [...buckets.entries()]
    .map(([key, group]) => toBucket(key, group, outcomeIndex))
    .sort((a, b) => b.sampleCount - a.sampleCount || a.key.localeCompare(b.key))
}

export async function buildCandidateReport(
  rootDir: string,
  options: { outcomeRootDir?: string | null } = {},
): Promise<CandidateReport> {
  const snapshots = await loadDecisionSnapshots(rootDir)
  const candidates = snapshots.filter((snapshot) => {
    const action = inferSnapshotLiveDecision(snapshot).action
    return action === 'candidate' || action === 'candidate_but_ineligible'
  })
  const directCandidates = candidates.filter((snapshot) => inferSnapshotLiveDecision(snapshot).action === 'candidate')
  const blockedCandidates = candidates.filter((snapshot) => inferSnapshotLiveDecision(snapshot).action === 'candidate_but_ineligible')
  const eligibleCandidates = candidates.filter((snapshot) => effectiveMarketEligibility(snapshot).eligible === true)
  const ineligibleCandidates = candidates.filter((snapshot) => effectiveMarketEligibility(snapshot).eligible !== true)
  const highQualityCandidates = candidates.filter((snapshot) => inferSnapshotQualityTier(snapshot) === 'high')
  const mediumQualityCandidates = candidates.filter((snapshot) => inferSnapshotQualityTier(snapshot) === 'medium')
  const outcomeIndex = options.outcomeRootDir ? await loadResolvedOutcomeIndex(options.outcomeRootDir) : undefined

  const resolvedCandidates = candidates
    .map((snapshot) => {
      const winner = resolvedWinnerWithOutcome(snapshot, outcomeIndex)
      const pFairA = snapshot.pFair.match.pMatchA
      const marketEligibility = effectiveMarketEligibility(snapshot)
      if (!winner || typeof pFairA !== 'number' || !Number.isFinite(pFairA)) return null
      return {
        capturedAt: snapshot.capturedAt,
        tourType: snapshot.prematchBaseline?.tourType || 'UNKNOWN',
        qualityTier: inferSnapshotQualityTier(snapshot),
        marketEligible: marketEligibility.eligible,
        marketEligibilityReasons: marketEligibility.reasons,
        matchId: snapshot.match.matchId,
        teamA: snapshot.match.teamA,
        teamB: snapshot.match.teamB,
        pFairA,
        marketLastA: snapshot.fairVsMarket.marketProbA.last,
        edgeVsLastA: snapshot.fairVsMarket.edgeA.vsLast,
        winner,
        correct: winner === 'teamA' ? pFairA >= 0.5 : pFairA < 0.5,
      } satisfies CandidateResolvedRow
    })
    .filter((value): value is CandidateResolvedRow => value != null)
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))

  return {
    version: 'candidate-report/v1',
    generatedAt: new Date().toISOString(),
    snapshotCount: snapshots.length,
    candidateCount: candidates.length,
    directCandidateCount: directCandidates.length,
    blockedCandidateCount: blockedCandidates.length,
    resolvedCandidateCount: resolvedCandidates.length,
    overall: toBucket('overall', candidates, outcomeIndex),
    directCandidateOnly: toBucket('direct_candidate_only', directCandidates, outcomeIndex),
    blockedCandidateOnly: toBucket('blocked_candidate_only', blockedCandidates, outcomeIndex),
    eligibleOnly: toBucket('eligible_only', eligibleCandidates, outcomeIndex),
    ineligibleOnly: toBucket('ineligible_only', ineligibleCandidates, outcomeIndex),
    highQualityOnly: toBucket('high_quality_only', highQualityCandidates, outcomeIndex),
    mediumQualityOnly: toBucket('medium_quality_only', mediumQualityCandidates, outcomeIndex),
    byLiveDecision: bucketize(
      candidates,
      (snapshot) => inferSnapshotLiveDecision(snapshot).action,
      outcomeIndex,
    ),
    byEligibility: bucketize(
      candidates,
      (snapshot) => effectiveMarketEligibility(snapshot).eligible === true ? 'eligible' : 'ineligible',
      outcomeIndex,
    ),
    byTourType: bucketize(candidates, (snapshot) => snapshot.prematchBaseline?.tourType || 'UNKNOWN', outcomeIndex),
    byQualityTier: bucketize(candidates, inferSnapshotQualityTier, outcomeIndex),
    byEdgeBucket: bucketize(candidates, edgeBucket, outcomeIndex),
    resolvedCandidates,
  }
}
