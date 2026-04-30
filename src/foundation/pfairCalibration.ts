import type { DecisionSnapshot } from './decisionSnapshot.js'
import { findResolvedOutcome, loadResolvedOutcomeIndex, type ResolvedMatchOutcome } from './resolvedOutcome.js'
import { inferSnapshotQualityTier } from './snapshotReportEnrichment.js'

export interface PFairCalibrationConfig {
  priorStrength: number
  maxAdjustment: number
  minProbability: number
  maxProbability: number
}

export interface PFairCalibrationRule {
  key: string
  resolvedCount: number
  meanRawPFairA: number
  winRateA: number
  rawBiasA: number
  confidenceWeight: number
  adjustmentA: number
}

export interface PFairCalibrationModel {
  version: 'p-fair-calibration/v1'
  generatedAt: string
  config: PFairCalibrationConfig
  trainingCount: number
  global: PFairCalibrationRule | null
  byPFairBucket: PFairCalibrationRule[]
}

export interface PFairCalibrationMetrics {
  sampleCount: number
  meanRawPFairA: number | null
  meanCalibratedPFairA: number | null
  winRateA: number | null
  rawBrierScoreA: number | null
  calibratedBrierScoreA: number | null
  rawLogLossA: number | null
  calibratedLogLossA: number | null
}

export interface PFairCalibrationBucket extends PFairCalibrationMetrics {
  key: string
}

export interface PFairCalibrationReport {
  version: 'p-fair-calibration-report/v1'
  generatedAt: string
  snapshotCount: number
  usableCount: number
  resolvedCount: number
  model: PFairCalibrationModel
  overall: PFairCalibrationBucket
  byPFairBucket: PFairCalibrationBucket[]
  byQualityTier: PFairCalibrationBucket[]
  byBaselineSource: PFairCalibrationBucket[]
  byTourType: PFairCalibrationBucket[]
}

const defaultConfig: PFairCalibrationConfig = {
  priorStrength: 20,
  maxAdjustment: 0.12,
  minProbability: 0.01,
  maxProbability: 0.99,
}

function mergeConfig(input: Partial<PFairCalibrationConfig> = {}): PFairCalibrationConfig {
  return {
    priorStrength: input.priorStrength ?? defaultConfig.priorStrength,
    maxAdjustment: input.maxAdjustment ?? defaultConfig.maxAdjustment,
    minProbability: input.minProbability ?? defaultConfig.minProbability,
    maxProbability: input.maxProbability ?? defaultConfig.maxProbability,
  }
}

interface ResolvedExample {
  snapshot: DecisionSnapshot
  y: 0 | 1
  pRaw: number
}

function mean(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function safeProbability(value: number, config: PFairCalibrationConfig): number {
  return clamp(value, config.minProbability, config.maxProbability)
}

function logLoss(p: number, y: 0 | 1): number {
  return -(y * Math.log(p) + (1 - y) * Math.log(1 - p))
}

function resolvedWinnerA(snapshot: DecisionSnapshot, outcomeIndex?: Map<string, ResolvedMatchOutcome>): 0 | 1 | null {
  if (snapshot.match.status === 'FINAL') {
    const setsA = snapshot.match.setsWonA
    const setsB = snapshot.match.setsWonB
    if (typeof setsA === 'number' && typeof setsB === 'number' && setsA !== setsB) {
      return setsA > setsB ? 1 : 0
    }
  }

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

export function pFairBucketFromValue(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'unknown'
  const lower = Math.floor(clamp(value, 0, 0.999999) * 10) / 10
  const upper = lower + 0.1
  return `${lower.toFixed(1)}-${upper.toFixed(1)}`
}

function pFairBucket(snapshot: DecisionSnapshot): string {
  return pFairBucketFromValue(snapshot.pFair.match.pMatchA)
}

function toResolvedExamples(
  snapshots: DecisionSnapshot[],
  config: PFairCalibrationConfig,
  outcomeIndex?: Map<string, ResolvedMatchOutcome>,
): ResolvedExample[] {
  return snapshots
    .map((snapshot) => {
      const y = resolvedWinnerA(snapshot, outcomeIndex)
      const raw = snapshot.pFair.match.pMatchA
      if (y == null || typeof raw !== 'number' || !Number.isFinite(raw)) return null
      return { snapshot, y, pRaw: safeProbability(raw, config) }
    })
    .filter((value): value is ResolvedExample => value != null)
}

function buildRule(key: string, examples: ResolvedExample[], config: PFairCalibrationConfig): PFairCalibrationRule | null {
  if (!examples.length) return null
  const meanRawPFairA = mean(examples.map((example) => example.pRaw))
  const winRateA = mean(examples.map((example) => example.y))
  if (meanRawPFairA == null || winRateA == null) return null
  const rawBiasA = winRateA - meanRawPFairA
  const confidenceWeight = examples.length / (examples.length + config.priorStrength)
  const adjustmentA = clamp(rawBiasA * confidenceWeight, -config.maxAdjustment, config.maxAdjustment)
  return {
    key,
    resolvedCount: examples.length,
    meanRawPFairA,
    winRateA,
    rawBiasA,
    confidenceWeight,
    adjustmentA,
  }
}

function groupBy<T>(entries: T[], keyFn: (entry: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const entry of entries) {
    const key = keyFn(entry)
    const group = groups.get(key)
    if (group) group.push(entry)
    else groups.set(key, [entry])
  }
  return groups
}

export function buildPFairCalibrationModel(
  snapshots: DecisionSnapshot[],
  inputConfig: Partial<PFairCalibrationConfig> = {},
  outcomeIndex?: Map<string, ResolvedMatchOutcome>,
): PFairCalibrationModel {
  const config = mergeConfig(inputConfig)
  const examples = toResolvedExamples(snapshots.filter((snapshot) => snapshot.fairVsMarket.available), config, outcomeIndex)
  const global = buildRule('global', examples, config)
  const byPFairBucket = [...groupBy(examples, (example) => pFairBucket(example.snapshot)).entries()]
    .map(([key, group]) => buildRule(key, group, config))
    .filter((rule): rule is PFairCalibrationRule => rule != null)
    .sort((a, b) => a.key.localeCompare(b.key))

  return {
    version: 'p-fair-calibration/v1',
    generatedAt: new Date().toISOString(),
    config,
    trainingCount: examples.length,
    global,
    byPFairBucket,
  }
}

export function calibratePFairA(rawPFairA: number | null | undefined, model: PFairCalibrationModel): number | null {
  if (typeof rawPFairA !== 'number' || !Number.isFinite(rawPFairA)) return null
  const raw = safeProbability(rawPFairA, model.config)
  const key = pFairBucketFromValue(raw)
  const rule = model.byPFairBucket.find((candidate) => candidate.key === key) || model.global
  if (!rule) return raw
  return safeProbability(raw + rule.adjustmentA, model.config)
}

function toMetrics(
  examples: ResolvedExample[],
  model: PFairCalibrationModel,
): PFairCalibrationMetrics {
  const calibrated = examples
    .map((example) => {
      const pCalibrated = calibratePFairA(example.pRaw, model)
      return pCalibrated == null ? null : { ...example, pCalibrated }
    })
    .filter((value): value is ResolvedExample & { pCalibrated: number } => value != null)

  return {
    sampleCount: calibrated.length,
    meanRawPFairA: mean(calibrated.map((example) => example.pRaw)),
    meanCalibratedPFairA: mean(calibrated.map((example) => example.pCalibrated)),
    winRateA: mean(calibrated.map((example) => example.y)),
    rawBrierScoreA: mean(calibrated.map((example) => (example.pRaw - example.y) ** 2)),
    calibratedBrierScoreA: mean(calibrated.map((example) => (example.pCalibrated - example.y) ** 2)),
    rawLogLossA: mean(calibrated.map((example) => logLoss(example.pRaw, example.y))),
    calibratedLogLossA: mean(calibrated.map((example) => logLoss(example.pCalibrated, example.y))),
  }
}

function bucketizeMetrics(
  examples: ResolvedExample[],
  model: PFairCalibrationModel,
  keyFn: (example: ResolvedExample) => string,
): PFairCalibrationBucket[] {
  return [...groupBy(examples, keyFn).entries()]
    .map(([key, group]) => ({
      key,
      ...toMetrics(group, model),
    }))
    .sort((a, b) => b.sampleCount - a.sampleCount || a.key.localeCompare(b.key))
}

export async function buildPFairCalibrationReport(input: {
  snapshots: DecisionSnapshot[]
  outcomeRootDir?: string | null
  config?: Partial<PFairCalibrationConfig>
}): Promise<PFairCalibrationReport> {
  const config = mergeConfig(input.config)
  const outcomeIndex = input.outcomeRootDir ? await loadResolvedOutcomeIndex(input.outcomeRootDir) : undefined
  const usable = input.snapshots.filter((snapshot) => snapshot.fairVsMarket.available)
  const model = buildPFairCalibrationModel(input.snapshots, config, outcomeIndex)
  const examples = toResolvedExamples(usable, config, outcomeIndex)

  return {
    version: 'p-fair-calibration-report/v1',
    generatedAt: new Date().toISOString(),
    snapshotCount: input.snapshots.length,
    usableCount: usable.length,
    resolvedCount: examples.length,
    model,
    overall: {
      key: 'overall',
      ...toMetrics(examples, model),
    },
    byPFairBucket: bucketizeMetrics(examples, model, (example) => pFairBucket(example.snapshot)),
    byQualityTier: bucketizeMetrics(examples, model, (example) => inferSnapshotQualityTier(example.snapshot)),
    byBaselineSource: bucketizeMetrics(examples, model, (example) => example.snapshot.prematchBaseline?.source || 'none'),
    byTourType: bucketizeMetrics(examples, model, (example) => example.snapshot.prematchBaseline?.tourType || 'UNKNOWN'),
  }
}
