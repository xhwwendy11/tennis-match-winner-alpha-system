import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import type { DecisionSnapshot } from './decisionSnapshot.js'
import { findResolvedOutcome, loadResolvedOutcomeIndex, type ResolvedMatchOutcome } from './resolvedOutcome.js'
import { inferSnapshotQualityTier, snapshotEdgeSignalBucket } from './snapshotReportEnrichment.js'

export interface CalibrationBucket {
  key: string
  sampleCount: number
  resolvedCount: number
  meanPFairA: number | null
  winRateA: number | null
  brierScoreA: number | null
  logLossA: number | null
  meanEdgeVsMidA: number | null
  meanAbsEdgeVsMidA: number | null
  meanEdgeVsLastA: number | null
}

export interface CalibrationReport {
  version: 'calibration-report/v1'
  generatedAt: string
  snapshotCount: number
  usableCount: number
  overall: CalibrationBucket
  byTourType: CalibrationBucket[]
  byTourGender: CalibrationBucket[]
  byQualityTier: CalibrationBucket[]
  byBaselineSource: CalibrationBucket[]
  byPFairBucket: CalibrationBucket[]
  byEdgeSignal: CalibrationBucket[]
  byPhase: CalibrationBucket[]
  byMatchedRule: CalibrationBucket[]
}

function mean(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
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

function pFairBucket(snapshot: DecisionSnapshot): string {
  const value = snapshot.pFair.match.pMatchA
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'unknown'
  const lower = Math.floor(clamp(value, 0, 0.999999) * 10) / 10
  const upper = lower + 0.1
  return `${lower.toFixed(1)}-${upper.toFixed(1)}`
}

function bucketize(
  entries: DecisionSnapshot[],
  keyFn: (snapshot: DecisionSnapshot) => string,
  outcomeIndex?: Map<string, ResolvedMatchOutcome>,
): CalibrationBucket[] {
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

function toBucket(
  key: string,
  entries: DecisionSnapshot[],
  outcomeIndex?: Map<string, ResolvedMatchOutcome>,
): CalibrationBucket {
  const resolved = entries
    .map((snapshot) => {
      const y = resolvedWinnerAWithOutcome(snapshot, outcomeIndex)
      const p = snapshot.pFair.match.pMatchA
      if (y == null || typeof p !== 'number' || !Number.isFinite(p)) return null
      return { y, p: clamp(p, 0.000001, 0.999999) }
    })
    .filter((value): value is { y: 0 | 1; p: number } => value != null)

  const edgeVsMidA = entries
    .map((snapshot) => snapshot.fairVsMarket.edgeA.vsMid)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  const edgeVsLastA = entries
    .map((snapshot) => snapshot.fairVsMarket.edgeA.vsLast)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  return {
    key,
    sampleCount: entries.length,
    resolvedCount: resolved.length,
    meanPFairA: mean(resolved.map((value) => value.p)),
    winRateA: mean(resolved.map((value) => value.y)),
    brierScoreA: mean(resolved.map((value) => (value.p - value.y) ** 2)),
    logLossA: mean(resolved.map((value) => -(value.y * Math.log(value.p) + (1 - value.y) * Math.log(1 - value.p)))),
    meanEdgeVsMidA: mean(edgeVsMidA),
    meanAbsEdgeVsMidA: mean(edgeVsMidA.map((value) => Math.abs(value))),
    meanEdgeVsLastA: mean(edgeVsLastA),
  }
}

async function walkJsonFiles(rootDir: string): Promise<string[]> {
  let entries
  try {
    entries = await readdir(rootDir, { withFileTypes: true })
  } catch {
    return []
  }

  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(rootDir, entry.name)
      if (entry.isDirectory()) return walkJsonFiles(fullPath)
      if (entry.isFile() && fullPath.endsWith('.json')) return [fullPath]
      return []
    }),
  )

  return files.flat()
}

export async function loadDecisionSnapshots(rootDir: string): Promise<DecisionSnapshot[]> {
  const files = await walkJsonFiles(rootDir)
  const parsed = await Promise.all(
    files.map(async (file) => {
      try {
        const text = await readFile(file, 'utf8')
        return JSON.parse(text) as DecisionSnapshot
      } catch {
        return null
      }
    }),
  )

  return parsed.filter((value): value is DecisionSnapshot => !!value && value.version === 'decision-snapshot/v1')
}

export async function buildCalibrationReport(
  rootDir: string,
  options: { outcomeRootDir?: string | null } = {},
): Promise<CalibrationReport> {
  const snapshots = await loadDecisionSnapshots(rootDir)
  const usable = snapshots.filter((snapshot) => snapshot.fairVsMarket.available)
  const outcomeIndex = options.outcomeRootDir ? await loadResolvedOutcomeIndex(options.outcomeRootDir) : undefined

  return {
    version: 'calibration-report/v1',
    generatedAt: new Date().toISOString(),
    snapshotCount: snapshots.length,
    usableCount: usable.length,
    overall: toBucket('overall', usable, outcomeIndex),
    byTourType: bucketize(
      usable,
      (snapshot) => snapshot.prematchBaseline?.tourType || 'UNKNOWN',
      outcomeIndex,
    ),
    byTourGender: bucketize(
      usable,
      (snapshot) => `${snapshot.prematchBaseline?.tourType || 'UNKNOWN'}:${snapshot.match.gender || 'unknown'}`,
      outcomeIndex,
    ),
    byQualityTier: bucketize(
      usable,
      inferSnapshotQualityTier,
      outcomeIndex,
    ),
    byBaselineSource: bucketize(
      usable,
      (snapshot) => snapshot.prematchBaseline?.source || 'none',
      outcomeIndex,
    ),
    byPFairBucket: bucketize(
      usable,
      pFairBucket,
      outcomeIndex,
    ),
    byEdgeSignal: bucketize(
      usable,
      snapshotEdgeSignalBucket,
      outcomeIndex,
    ),
    byPhase: bucketize(
      usable,
      (snapshot) => snapshot.risk.phase || 'unknown',
      outcomeIndex,
    ),
    byMatchedRule: bucketize(
      usable,
      (snapshot) => snapshot.risk.matchedRule || 'unmatched',
      outcomeIndex,
    ),
  }
}
