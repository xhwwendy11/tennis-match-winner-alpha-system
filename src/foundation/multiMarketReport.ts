import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { findResolvedOutcome, loadResolvedOutcomeIndex, type ResolvedMatchOutcome } from './resolvedOutcome.js'
import type { MultiMarketComparison } from './multiMarketComparison.js'

export interface MultiMarketReportBucket {
  key: string
  sampleCount: number
  bothAvailableCount: number
  resolvedCount: number
  meanCrossSpreadA: number | null
  meanAbsCrossSpreadA: number | null
  kalshiBetterValueTeamACount: number
  polymarketBetterValueTeamACount: number
  kalshiBetterValueTeamBCount: number
  polymarketBetterValueTeamBCount: number
  kalshiCandidateCount: number
  polymarketCandidateCount: number
  kalshiBlockedCandidateCount: number
  polymarketBlockedCandidateCount: number
  kalshiEligibleCount: number
  polymarketEligibleCount: number
}

export interface MultiMarketResolvedRow {
  capturedAt: string
  matchId: string | null
  teamA: string | null
  teamB: string | null
  tourType: string
  qualityTier: string
  winner: 'teamA' | 'teamB'
  pFairA: number
  kalshiLastA: number | null
  polymarketLastA: number | null
  crossSpreadA: number | null
  kalshiEdgeA: number | null
  polymarketEdgeA: number | null
  kalshiDecision: string | null
  polymarketDecision: string | null
  betterValueForTeamA: string
  betterValueForTeamB: string
}

export interface MultiMarketReport {
  version: 'multi-market-report/v1'
  generatedAt: string
  comparisonCount: number
  bothAvailableCount: number
  resolvedCount: number
  overall: MultiMarketReportBucket
  byTourType: MultiMarketReportBucket[]
  byQualityTier: MultiMarketReportBucket[]
  resolvedComparisons: MultiMarketResolvedRow[]
}

function mean(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
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

export async function loadMultiMarketComparisons(rootDir: string): Promise<MultiMarketComparison[]> {
  const files = await walkJsonFiles(rootDir)
  const parsed = await Promise.all(
    files.map(async (file) => {
      try {
        const text = await readFile(file, 'utf8')
        return JSON.parse(text) as MultiMarketComparison
      } catch {
        return null
      }
    }),
  )

  return parsed.filter((value): value is MultiMarketComparison => !!value && value.version === 'multi-market-comparison/v1')
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

function toBucket(key: string, comparisons: MultiMarketComparison[], outcomeIndex?: Map<string, ResolvedMatchOutcome>): MultiMarketReportBucket {
  const crossSpreadA = comparisons
    .map((comparison) => comparison.crossMarket.marketProbA.spreadKalshiMinusPolymarket)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  return {
    key,
    sampleCount: comparisons.length,
    bothAvailableCount: comparisons.filter((comparison) => comparison.crossMarket.bothAvailable).length,
    resolvedCount: comparisons.filter((comparison) => resolvedWinnerWithOutcome(comparison, outcomeIndex) != null).length,
    meanCrossSpreadA: mean(crossSpreadA),
    meanAbsCrossSpreadA: mean(crossSpreadA.map((value) => Math.abs(value))),
    kalshiBetterValueTeamACount: comparisons.filter((comparison) => comparison.crossMarket.betterValueForTeamA === 'kalshi').length,
    polymarketBetterValueTeamACount: comparisons.filter((comparison) => comparison.crossMarket.betterValueForTeamA === 'polymarket').length,
    kalshiBetterValueTeamBCount: comparisons.filter((comparison) => comparison.crossMarket.betterValueForTeamB === 'kalshi').length,
    polymarketBetterValueTeamBCount: comparisons.filter((comparison) => comparison.crossMarket.betterValueForTeamB === 'polymarket').length,
    kalshiCandidateCount: comparisons.filter((comparison) => comparison.markets.kalshi?.liveDecision.action === 'candidate').length,
    polymarketCandidateCount: comparisons.filter((comparison) => comparison.markets.polymarket?.liveDecision.action === 'candidate').length,
    kalshiBlockedCandidateCount: comparisons.filter((comparison) => comparison.markets.kalshi?.liveDecision.action === 'candidate_but_ineligible').length,
    polymarketBlockedCandidateCount: comparisons.filter((comparison) => comparison.markets.polymarket?.liveDecision.action === 'candidate_but_ineligible').length,
    kalshiEligibleCount: comparisons.filter((comparison) => comparison.markets.kalshi?.marketEligibility.eligible === true).length,
    polymarketEligibleCount: comparisons.filter((comparison) => comparison.markets.polymarket?.marketEligibility.eligible === true).length,
  }
}

function bucketize(
  comparisons: MultiMarketComparison[],
  keyFn: (comparison: MultiMarketComparison) => string,
  outcomeIndex?: Map<string, ResolvedMatchOutcome>,
): MultiMarketReportBucket[] {
  const buckets = new Map<string, MultiMarketComparison[]>()
  for (const comparison of comparisons) {
    const key = keyFn(comparison)
    const group = buckets.get(key)
    if (group) group.push(comparison)
    else buckets.set(key, [comparison])
  }

  return [...buckets.entries()]
    .map(([key, group]) => toBucket(key, group, outcomeIndex))
    .sort((a, b) => b.sampleCount - a.sampleCount || a.key.localeCompare(b.key))
}

export async function buildMultiMarketReport(
  rootDir: string,
  options: { outcomeRootDir?: string | null } = {},
): Promise<MultiMarketReport> {
  const comparisons = await loadMultiMarketComparisons(rootDir)
  const outcomeIndex = options.outcomeRootDir ? await loadResolvedOutcomeIndex(options.outcomeRootDir) : undefined

  const resolvedComparisons = comparisons
    .map((comparison) => {
      const winner = resolvedWinnerWithOutcome(comparison, outcomeIndex)
      const pFairA = comparison.pFair.match.pMatchA
      if (!winner || typeof pFairA !== 'number' || !Number.isFinite(pFairA)) return null

      return {
        capturedAt: comparison.capturedAt,
        matchId: comparison.match.matchId,
        teamA: comparison.match.teamA,
        teamB: comparison.match.teamB,
        tourType: comparison.prematchBaseline?.tourType || 'UNKNOWN',
        qualityTier: comparison.quality.tier,
        winner,
        pFairA,
        kalshiLastA: comparison.markets.kalshi?.fairVsMarket.marketProbA.last ?? null,
        polymarketLastA: comparison.markets.polymarket?.fairVsMarket.marketProbA.last ?? null,
        crossSpreadA: comparison.crossMarket.marketProbA.spreadKalshiMinusPolymarket,
        kalshiEdgeA: comparison.markets.kalshi?.fairVsMarket.edgeA.vsLast ?? null,
        polymarketEdgeA: comparison.markets.polymarket?.fairVsMarket.edgeA.vsLast ?? null,
        kalshiDecision: comparison.markets.kalshi?.liveDecision.action ?? null,
        polymarketDecision: comparison.markets.polymarket?.liveDecision.action ?? null,
        betterValueForTeamA: comparison.crossMarket.betterValueForTeamA,
        betterValueForTeamB: comparison.crossMarket.betterValueForTeamB,
      } satisfies MultiMarketResolvedRow
    })
    .filter((value): value is MultiMarketResolvedRow => value != null)
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))

  return {
    version: 'multi-market-report/v1',
    generatedAt: new Date().toISOString(),
    comparisonCount: comparisons.length,
    bothAvailableCount: comparisons.filter((comparison) => comparison.crossMarket.bothAvailable).length,
    resolvedCount: resolvedComparisons.length,
    overall: toBucket('overall', comparisons, outcomeIndex),
    byTourType: bucketize(comparisons, (comparison) => comparison.prematchBaseline?.tourType || 'UNKNOWN', outcomeIndex),
    byQualityTier: bucketize(comparisons, (comparison) => comparison.quality.tier, outcomeIndex),
    resolvedComparisons,
  }
}
