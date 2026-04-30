import { loadMultiMarketComparisons } from './multiMarketReport.js'
import type { MultiMarketComparison, MultiMarketProviderView } from './multiMarketComparison.js'

export interface RecaptureActionCounts {
  candidate: number
  blockedCandidate: number
  watchOnly: number
  ignore: number
}

export interface RecaptureProviderPathSummary {
  provider: 'kalshi' | 'polymarket'
  availableCount: number
  eligibleCount: number
  actionCounts: RecaptureActionCounts
  actionTransitionCount: number
  firstLastA: number | null
  lastLastA: number | null
  minLastA: number | null
  maxLastA: number | null
  rangeLastA: number | null
  firstEdgeA: number | null
  lastEdgeA: number | null
  minEdgeA: number | null
  maxEdgeA: number | null
  rangeEdgeA: number | null
}

export interface RecaptureCrossMarketPathSummary {
  comparableCount: number
  firstSpreadA: number | null
  lastSpreadA: number | null
  minSpreadA: number | null
  maxSpreadA: number | null
  rangeSpreadA: number | null
  signChangeCount: number
  kalshiBetterValueTeamACount: number
  polymarketBetterValueTeamACount: number
  tieBetterValueTeamACount: number
  kalshiBetterValueTeamBCount: number
  polymarketBetterValueTeamBCount: number
  tieBetterValueTeamBCount: number
}

export interface RecapturePathSummary {
  pathKey: string
  flashscoreMatchUrl: string | null
  matchId: string | null
  teamA: string | null
  teamB: string | null
  tourType: string
  qualityTier: string
  startedAt: string
  endedAt: string
  durationSeconds: number
  captureCount: number
  bothAvailableCount: number
  kalshi: RecaptureProviderPathSummary
  polymarket: RecaptureProviderPathSummary
  crossMarket: RecaptureCrossMarketPathSummary
}

export interface RecapturePathReport {
  version: 'recapture-path-report/v1'
  generatedAt: string
  comparisonCount: number
  pathCount: number
  multiCapturePathCount: number
  meanCapturesPerPath: number | null
  meanDurationSeconds: number | null
  meanCrossSpreadRangeA: number | null
  meanKalshiRangeA: number | null
  meanPolymarketRangeA: number | null
  paths: RecapturePathSummary[]
}

function mean(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function numericStats(values: Array<number | null | undefined>): {
  first: number | null
  last: number | null
  min: number | null
  max: number | null
  range: number | null
} {
  const filtered = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (!filtered.length) {
    return { first: null, last: null, min: null, max: null, range: null }
  }

  const min = Math.min(...filtered)
  const max = Math.max(...filtered)
  return {
    first: filtered[0] ?? null,
    last: filtered[filtered.length - 1] ?? null,
    min,
    max,
    range: max - min,
  }
}

function buildEmptyActionCounts(): RecaptureActionCounts {
  return {
    candidate: 0,
    blockedCandidate: 0,
    watchOnly: 0,
    ignore: 0,
  }
}

function countAction(actionCounts: RecaptureActionCounts, action: string): void {
  if (action === 'candidate') actionCounts.candidate += 1
  else if (action === 'candidate_but_ineligible') actionCounts.blockedCandidate += 1
  else if (action === 'watch_only') actionCounts.watchOnly += 1
  else if (action === 'ignore') actionCounts.ignore += 1
}

function buildProviderPathSummary(
  comparisons: MultiMarketComparison[],
  selector: (comparison: MultiMarketComparison) => MultiMarketProviderView | null,
  provider: 'kalshi' | 'polymarket',
): RecaptureProviderPathSummary {
  const views = comparisons.map(selector).filter((value): value is MultiMarketProviderView => value != null)
  const actionCounts = buildEmptyActionCounts()
  let transitions = 0
  let previousAction: string | null = null

  for (const view of views) {
    countAction(actionCounts, view.liveDecision.action)
    if (previousAction && previousAction !== view.liveDecision.action) transitions += 1
    previousAction = view.liveDecision.action
  }

  const lastAStats = numericStats(views.map((view) => view.fairVsMarket.marketProbA.last))
  const edgeAStats = numericStats(views.map((view) => view.fairVsMarket.edgeA.vsLast))

  return {
    provider,
    availableCount: views.length,
    eligibleCount: views.filter((view) => view.marketEligibility.eligible).length,
    actionCounts,
    actionTransitionCount: transitions,
    firstLastA: lastAStats.first,
    lastLastA: lastAStats.last,
    minLastA: lastAStats.min,
    maxLastA: lastAStats.max,
    rangeLastA: lastAStats.range,
    firstEdgeA: edgeAStats.first,
    lastEdgeA: edgeAStats.last,
    minEdgeA: edgeAStats.min,
    maxEdgeA: edgeAStats.max,
    rangeEdgeA: edgeAStats.range,
  }
}

function countSignChanges(values: Array<number | null | undefined>): number {
  const filtered = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  let changes = 0
  let previousSign: number | null = null

  for (const value of filtered) {
    const sign = value > 0 ? 1 : value < 0 ? -1 : 0
    if (previousSign != null && sign !== 0 && previousSign !== 0 && sign !== previousSign) changes += 1
    if (sign !== 0) previousSign = sign
  }

  return changes
}

function buildCrossMarketPathSummary(comparisons: MultiMarketComparison[]): RecaptureCrossMarketPathSummary {
  const spreads = comparisons.map((comparison) => comparison.crossMarket.marketProbA.spreadKalshiMinusPolymarket)
  const spreadStats = numericStats(spreads)

  return {
    comparableCount: comparisons.filter((comparison) => comparison.crossMarket.bothAvailable).length,
    firstSpreadA: spreadStats.first,
    lastSpreadA: spreadStats.last,
    minSpreadA: spreadStats.min,
    maxSpreadA: spreadStats.max,
    rangeSpreadA: spreadStats.range,
    signChangeCount: countSignChanges(spreads),
    kalshiBetterValueTeamACount: comparisons.filter((comparison) => comparison.crossMarket.betterValueForTeamA === 'kalshi').length,
    polymarketBetterValueTeamACount: comparisons.filter((comparison) => comparison.crossMarket.betterValueForTeamA === 'polymarket').length,
    tieBetterValueTeamACount: comparisons.filter((comparison) => comparison.crossMarket.betterValueForTeamA === 'tie').length,
    kalshiBetterValueTeamBCount: comparisons.filter((comparison) => comparison.crossMarket.betterValueForTeamB === 'kalshi').length,
    polymarketBetterValueTeamBCount: comparisons.filter((comparison) => comparison.crossMarket.betterValueForTeamB === 'polymarket').length,
    tieBetterValueTeamBCount: comparisons.filter((comparison) => comparison.crossMarket.betterValueForTeamB === 'tie').length,
  }
}

function buildPathKey(comparison: MultiMarketComparison): string {
  return (
    comparison.urls.flashscoreMatchUrl ||
    comparison.match.matchId ||
    `${comparison.match.teamA || 'unknown'}__${comparison.match.teamB || 'unknown'}`
  )
}

function toPathSummary(pathKey: string, comparisons: MultiMarketComparison[]): RecapturePathSummary {
  const sorted = [...comparisons].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
  const first = sorted[0]!
  const last = sorted[sorted.length - 1]!
  const startedAt = first.capturedAt
  const endedAt = last.capturedAt
  const durationSeconds = Math.max(0, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000))

  return {
    pathKey,
    flashscoreMatchUrl: first.urls.flashscoreMatchUrl,
    matchId: first.match.matchId,
    teamA: first.match.teamA,
    teamB: first.match.teamB,
    tourType: first.prematchBaseline?.tourType || 'UNKNOWN',
    qualityTier: first.quality.tier,
    startedAt,
    endedAt,
    durationSeconds,
    captureCount: sorted.length,
    bothAvailableCount: sorted.filter((comparison) => comparison.crossMarket.bothAvailable).length,
    kalshi: buildProviderPathSummary(sorted, (comparison) => comparison.markets.kalshi, 'kalshi'),
    polymarket: buildProviderPathSummary(sorted, (comparison) => comparison.markets.polymarket, 'polymarket'),
    crossMarket: buildCrossMarketPathSummary(sorted),
  }
}

export async function buildRecapturePathReport(rootDir: string): Promise<RecapturePathReport> {
  const comparisons = await loadMultiMarketComparisons(rootDir)
  const grouped = new Map<string, MultiMarketComparison[]>()

  for (const comparison of comparisons) {
    const key = buildPathKey(comparison)
    const existing = grouped.get(key)
    if (existing) existing.push(comparison)
    else grouped.set(key, [comparison])
  }

  const paths = [...grouped.entries()]
    .map(([pathKey, group]) => toPathSummary(pathKey, group))
    .sort((a, b) => b.captureCount - a.captureCount || a.startedAt.localeCompare(b.startedAt))

  return {
    version: 'recapture-path-report/v1',
    generatedAt: new Date().toISOString(),
    comparisonCount: comparisons.length,
    pathCount: paths.length,
    multiCapturePathCount: paths.filter((path) => path.captureCount > 1).length,
    meanCapturesPerPath: mean(paths.map((path) => path.captureCount)),
    meanDurationSeconds: mean(paths.map((path) => path.durationSeconds)),
    meanCrossSpreadRangeA: mean(
      paths
        .map((path) => path.crossMarket.rangeSpreadA)
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value)),
    ),
    meanKalshiRangeA: mean(
      paths.map((path) => path.kalshi.rangeLastA).filter((value): value is number => typeof value === 'number' && Number.isFinite(value)),
    ),
    meanPolymarketRangeA: mean(
      paths.map((path) => path.polymarket.rangeLastA).filter((value): value is number => typeof value === 'number' && Number.isFinite(value)),
    ),
    paths,
  }
}
