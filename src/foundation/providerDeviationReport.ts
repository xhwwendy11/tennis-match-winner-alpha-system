import { findResolvedOutcome, loadResolvedOutcomeIndex, type ResolvedMatchOutcome } from './resolvedOutcome.js'
import { loadMultiMarketComparisons } from './multiMarketReport.js'
import type { MultiMarketComparison, MultiMarketProviderView } from './multiMarketComparison.js'

export interface ProviderDeviationBucket {
  key: string
  sampleCount: number
  resolvedCount: number
  eligibleCount: number
  candidateCount: number
  blockedCandidateCount: number
  watchOnlyCount: number
  ignoreCount: number
  meanMarketLastA: number | null
  meanEdgeVsLastA: number | null
  meanAbsEdgeVsLastA: number | null
  meanEdgeVsAskA: number | null
  meanAbsEdgeVsAskA: number | null
  meanPFairA: number | null
  winRateA: number | null
  brierScoreA: number | null
  logLossA: number | null
}

export interface ProviderDeviationResolvedRow {
  capturedAt: string
  provider: 'kalshi' | 'polymarket'
  matchId: string | null
  teamA: string | null
  teamB: string | null
  tourType: string
  qualityTier: string
  winner: 'teamA' | 'teamB'
  pFairA: number
  marketLastA: number | null
  edgeVsLastA: number | null
  edgeVsAskA: number | null
  eligible: boolean
  liveDecision: string
}

export interface ProviderDeviationReport {
  version: 'provider-deviation-report/v1'
  generatedAt: string
  comparisonCount: number
  providerSampleCount: number
  resolvedProviderSampleCount: number
  overallByProvider: ProviderDeviationBucket[]
  byTourType: ProviderDeviationBucket[]
  byQualityTier: ProviderDeviationBucket[]
  resolvedRows: ProviderDeviationResolvedRow[]
}

interface ProviderSample {
  provider: 'kalshi' | 'polymarket'
  comparison: MultiMarketComparison
  view: MultiMarketProviderView
}

function mean(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function resolvedWinner(comparison: MultiMarketComparison): 'teamA' | 'teamB' | null {
  if (comparison.match.status !== 'FINAL') return null
  const setsA = comparison.match.setsWonA
  const setsB = comparison.match.setsWonB
  if (typeof setsA !== 'number' || typeof setsB !== 'number' || setsA === setsB) return null
  return setsA > setsB ? 'teamA' : 'teamB'
}

function resolvedWinnerWithOutcome(
  comparison: MultiMarketComparison,
  outcomeIndex?: Map<string, ResolvedMatchOutcome>,
): 'teamA' | 'teamB' | null {
  const direct = resolvedWinner(comparison)
  if (direct) return direct
  if (!outcomeIndex) return null

  const outcome = findResolvedOutcome(outcomeIndex, {
    matchId: comparison.match.matchId,
    flashscoreMatchUrl: comparison.urls.flashscoreMatchUrl,
  })
  if (!outcome || outcome.status !== 'FINAL') return null
  return outcome.winner
}

function flattenProviderSamples(comparisons: MultiMarketComparison[]): ProviderSample[] {
  const samples: ProviderSample[] = []
  for (const comparison of comparisons) {
    if (comparison.markets.kalshi) {
      samples.push({ provider: 'kalshi', comparison, view: comparison.markets.kalshi })
    }
    if (comparison.markets.polymarket) {
      samples.push({ provider: 'polymarket', comparison, view: comparison.markets.polymarket })
    }
  }
  return samples
}

function toBucket(key: string, samples: ProviderSample[], outcomeIndex?: Map<string, ResolvedMatchOutcome>): ProviderDeviationBucket {
  const resolved = samples
    .map((sample) => {
      const winner = resolvedWinnerWithOutcome(sample.comparison, outcomeIndex)
      const pFairA = sample.comparison.pFair.match.pMatchA
      if (!winner || typeof pFairA !== 'number' || !Number.isFinite(pFairA)) return null
      return { y: winner === 'teamA' ? 1 : 0, p: clamp(pFairA, 0.000001, 0.999999) }
    })
    .filter((value): value is { y: 0 | 1; p: number } => value != null)

  const marketLastA = samples
    .map((sample) => sample.view.fairVsMarket.marketProbA.last)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const edgeVsLastA = samples
    .map((sample) => sample.view.fairVsMarket.edgeA.vsLast)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const edgeVsAskA = samples
    .map((sample) => sample.view.fairVsMarket.edgeA.vsAsk)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  return {
    key,
    sampleCount: samples.length,
    resolvedCount: resolved.length,
    eligibleCount: samples.filter((sample) => sample.view.marketEligibility.eligible).length,
    candidateCount: samples.filter((sample) => sample.view.liveDecision.action === 'candidate').length,
    blockedCandidateCount: samples.filter((sample) => sample.view.liveDecision.action === 'candidate_but_ineligible').length,
    watchOnlyCount: samples.filter((sample) => sample.view.liveDecision.action === 'watch_only').length,
    ignoreCount: samples.filter((sample) => sample.view.liveDecision.action === 'ignore').length,
    meanMarketLastA: mean(marketLastA),
    meanEdgeVsLastA: mean(edgeVsLastA),
    meanAbsEdgeVsLastA: mean(edgeVsLastA.map((value) => Math.abs(value))),
    meanEdgeVsAskA: mean(edgeVsAskA),
    meanAbsEdgeVsAskA: mean(edgeVsAskA.map((value) => Math.abs(value))),
    meanPFairA: mean(resolved.map((value) => value.p)),
    winRateA: mean(resolved.map((value) => value.y)),
    brierScoreA: mean(resolved.map((value) => (value.p - value.y) ** 2)),
    logLossA: mean(resolved.map((value) => -(value.y * Math.log(value.p) + (1 - value.y) * Math.log(1 - value.p)))),
  }
}

function bucketize(
  samples: ProviderSample[],
  keyFn: (sample: ProviderSample) => string,
  outcomeIndex?: Map<string, ResolvedMatchOutcome>,
): ProviderDeviationBucket[] {
  const buckets = new Map<string, ProviderSample[]>()
  for (const sample of samples) {
    const key = keyFn(sample)
    const group = buckets.get(key)
    if (group) group.push(sample)
    else buckets.set(key, [sample])
  }

  return [...buckets.entries()]
    .map(([key, group]) => toBucket(key, group, outcomeIndex))
    .sort((a, b) => b.sampleCount - a.sampleCount || a.key.localeCompare(b.key))
}

export async function buildProviderDeviationReport(
  rootDir: string,
  options: { outcomeRootDir?: string | null } = {},
): Promise<ProviderDeviationReport> {
  const comparisons = await loadMultiMarketComparisons(rootDir)
  const outcomeIndex = options.outcomeRootDir ? await loadResolvedOutcomeIndex(options.outcomeRootDir) : undefined
  const samples = flattenProviderSamples(comparisons)

  const resolvedRows = samples
    .map((sample) => {
      const winner = resolvedWinnerWithOutcome(sample.comparison, outcomeIndex)
      const pFairA = sample.comparison.pFair.match.pMatchA
      if (!winner || typeof pFairA !== 'number' || !Number.isFinite(pFairA)) return null

      return {
        capturedAt: sample.comparison.capturedAt,
        provider: sample.provider,
        matchId: sample.comparison.match.matchId,
        teamA: sample.comparison.match.teamA,
        teamB: sample.comparison.match.teamB,
        tourType: sample.comparison.prematchBaseline?.tourType || 'UNKNOWN',
        qualityTier: sample.comparison.quality.tier,
        winner,
        pFairA,
        marketLastA: sample.view.fairVsMarket.marketProbA.last,
        edgeVsLastA: sample.view.fairVsMarket.edgeA.vsLast,
        edgeVsAskA: sample.view.fairVsMarket.edgeA.vsAsk,
        eligible: sample.view.marketEligibility.eligible,
        liveDecision: sample.view.liveDecision.action,
      } satisfies ProviderDeviationResolvedRow
    })
    .filter((value): value is ProviderDeviationResolvedRow => value != null)
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt) || a.provider.localeCompare(b.provider))

  return {
    version: 'provider-deviation-report/v1',
    generatedAt: new Date().toISOString(),
    comparisonCount: comparisons.length,
    providerSampleCount: samples.length,
    resolvedProviderSampleCount: resolvedRows.length,
    overallByProvider: bucketize(samples, (sample) => sample.provider, outcomeIndex),
    byTourType: bucketize(samples, (sample) => `${sample.provider}:${sample.comparison.prematchBaseline?.tourType || 'UNKNOWN'}`, outcomeIndex),
    byQualityTier: bucketize(samples, (sample) => `${sample.provider}:${sample.comparison.quality.tier}`, outcomeIndex),
    resolvedRows,
  }
}
