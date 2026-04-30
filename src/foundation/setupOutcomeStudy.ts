import { findResolvedOutcome, loadResolvedOutcomeIndex, type ResolvedMatchOutcome } from './resolvedOutcome.js'
import { loadMultiMarketComparisons } from './multiMarketReport.js'
import type { MultiMarketComparison } from './multiMarketComparison.js'
import { classifyTradeSetup, type TradeSetupType } from './setupTaxonomy.js'

export interface SetupOutcomeBucket {
  key: string
  sampleCount: number
  resolvedCount: number
  directCount: number
  blockedCount: number
  watchOnlyCount: number
  correctDirectionCount: number
  correctDirectionRate: number | null
  meanPFairA: number | null
  meanAbsCrossSpreadA: number | null
  meanKalshiEdgeA: number | null
  meanPolymarketEdgeA: number | null
  kalshiCloserCount: number
  polymarketCloserCount: number
  tieCloserCount: number
}

export interface SetupOutcomeRow {
  capturedAt: string
  matchId: string | null
  teamA: string | null
  teamB: string | null
  tourType: string
  qualityTier: string
  winner: 'teamA' | 'teamB'
  actualA: 0 | 1
  pFairA: number
  setupType: TradeSetupType
  primaryProvider: 'kalshi' | 'polymarket' | 'none'
  side: 'teamA' | 'teamB' | 'none'
  correctDirection: boolean | null
  crossSpreadA: number | null
  kalshiLastA: number | null
  polymarketLastA: number | null
  kalshiEdgeA: number | null
  polymarketEdgeA: number | null
  closerProvider: 'kalshi' | 'polymarket' | 'tie' | 'unknown'
}

export interface SetupOutcomeStudy {
  version: 'setup-outcome-study/v1'
  generatedAt: string
  comparisonCount: number
  resolvedCount: number
  overallBySetup: SetupOutcomeBucket[]
  byTourType: SetupOutcomeBucket[]
  byQualityTier: SetupOutcomeBucket[]
  rows: SetupOutcomeRow[]
}

function mean(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
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

function absError(probA: number | null, actualA: 0 | 1): number | null {
  if (probA == null || !Number.isFinite(probA)) return null
  return Math.abs(probA - actualA)
}

function chooseCloser(kalshiErrorA: number | null, polymarketErrorA: number | null): 'kalshi' | 'polymarket' | 'tie' | 'unknown' {
  if (kalshiErrorA == null || polymarketErrorA == null) return 'unknown'
  if (Math.abs(kalshiErrorA - polymarketErrorA) < 1e-9) return 'tie'
  return kalshiErrorA < polymarketErrorA ? 'kalshi' : 'polymarket'
}

function isDirectSetup(type: TradeSetupType): boolean {
  return type.startsWith('cross_market_') || type.startsWith('single_market_')
}

function isBlockedSetup(type: TradeSetupType): boolean {
  return type === 'blocked_candidate'
}

function isWatchOnlySetup(type: TradeSetupType): boolean {
  return type === 'watch_only_dislocation'
}

function correctDirection(side: 'teamA' | 'teamB' | 'none', actualA: 0 | 1): boolean | null {
  if (side === 'none') return null
  return side === 'teamA' ? actualA === 1 : actualA === 0
}

function toRow(comparison: MultiMarketComparison, outcomeIndex?: Map<string, ResolvedMatchOutcome>): SetupOutcomeRow | null {
  const winner = resolvedWinnerWithOutcome(comparison, outcomeIndex)
  const pFairA = comparison.pFair.match.pMatchA
  if (!winner || typeof pFairA !== 'number' || !Number.isFinite(pFairA)) return null

  const setup = classifyTradeSetup(comparison)
  const actualA: 0 | 1 = winner === 'teamA' ? 1 : 0
  const kalshiLastA = comparison.markets.kalshi?.fairVsMarket.marketProbA.last ?? null
  const polymarketLastA = comparison.markets.polymarket?.fairVsMarket.marketProbA.last ?? null
  const kalshiErrorA = absError(kalshiLastA, actualA)
  const polymarketErrorA = absError(polymarketLastA, actualA)

  return {
    capturedAt: comparison.capturedAt,
    matchId: comparison.match.matchId,
    teamA: comparison.match.teamA,
    teamB: comparison.match.teamB,
    tourType: comparison.prematchBaseline?.tourType || 'UNKNOWN',
    qualityTier: comparison.quality.tier,
    winner,
    actualA,
    pFairA,
    setupType: setup.type,
    primaryProvider: setup.primaryProvider,
    side: setup.side,
    correctDirection: correctDirection(setup.side, actualA),
    crossSpreadA: comparison.crossMarket.marketProbA.spreadKalshiMinusPolymarket,
    kalshiLastA,
    polymarketLastA,
    kalshiEdgeA: comparison.markets.kalshi?.fairVsMarket.edgeA.vsLast ?? null,
    polymarketEdgeA: comparison.markets.polymarket?.fairVsMarket.edgeA.vsLast ?? null,
    closerProvider: chooseCloser(kalshiErrorA, polymarketErrorA),
  }
}

function toBucket(key: string, rows: SetupOutcomeRow[]): SetupOutcomeBucket {
  const pFairA = rows.map((row) => row.pFairA).filter((value): value is number => Number.isFinite(value))
  const crossSpreadA = rows
    .map((row) => row.crossSpreadA)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const kalshiEdgeA = rows
    .map((row) => row.kalshiEdgeA)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const polymarketEdgeA = rows
    .map((row) => row.polymarketEdgeA)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const directionRows = rows.filter((row) => row.correctDirection != null)

  return {
    key,
    sampleCount: rows.length,
    resolvedCount: rows.length,
    directCount: rows.filter((row) => isDirectSetup(row.setupType)).length,
    blockedCount: rows.filter((row) => isBlockedSetup(row.setupType)).length,
    watchOnlyCount: rows.filter((row) => isWatchOnlySetup(row.setupType)).length,
    correctDirectionCount: directionRows.filter((row) => row.correctDirection === true).length,
    correctDirectionRate: directionRows.length ? directionRows.filter((row) => row.correctDirection === true).length / directionRows.length : null,
    meanPFairA: mean(pFairA),
    meanAbsCrossSpreadA: mean(crossSpreadA.map((value) => Math.abs(value))),
    meanKalshiEdgeA: mean(kalshiEdgeA),
    meanPolymarketEdgeA: mean(polymarketEdgeA),
    kalshiCloserCount: rows.filter((row) => row.closerProvider === 'kalshi').length,
    polymarketCloserCount: rows.filter((row) => row.closerProvider === 'polymarket').length,
    tieCloserCount: rows.filter((row) => row.closerProvider === 'tie').length,
  }
}

function bucketize(rows: SetupOutcomeRow[], keyFn: (row: SetupOutcomeRow) => string): SetupOutcomeBucket[] {
  const groups = new Map<string, SetupOutcomeRow[]>()
  for (const row of rows) {
    const key = keyFn(row)
    const group = groups.get(key)
    if (group) group.push(row)
    else groups.set(key, [row])
  }

  return [...groups.entries()]
    .map(([key, group]) => toBucket(key, group))
    .sort((a, b) => b.sampleCount - a.sampleCount || a.key.localeCompare(b.key))
}

export async function buildSetupOutcomeStudy(
  rootDir: string,
  options: { outcomeRootDir?: string | null } = {},
): Promise<SetupOutcomeStudy> {
  const comparisons = await loadMultiMarketComparisons(rootDir)
  const outcomeIndex = options.outcomeRootDir ? await loadResolvedOutcomeIndex(options.outcomeRootDir) : undefined

  const rows = comparisons
    .map((comparison) => toRow(comparison, outcomeIndex))
    .filter((value): value is SetupOutcomeRow => value != null)
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))

  return {
    version: 'setup-outcome-study/v1',
    generatedAt: new Date().toISOString(),
    comparisonCount: comparisons.length,
    resolvedCount: rows.length,
    overallBySetup: bucketize(rows, (row) => row.setupType),
    byTourType: bucketize(rows, (row) => `${row.setupType}:${row.tourType}`),
    byQualityTier: bucketize(rows, (row) => `${row.setupType}:${row.qualityTier}`),
    rows,
  }
}
