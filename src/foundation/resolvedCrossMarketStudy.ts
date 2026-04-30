import { findResolvedOutcome, loadResolvedOutcomeIndex, type ResolvedMatchOutcome } from './resolvedOutcome.js'
import { loadMultiMarketComparisons } from './multiMarketReport.js'
import type { MultiMarketComparison } from './multiMarketComparison.js'

export interface ResolvedCrossMarketBucket {
  key: string
  sampleCount: number
  kalshiCloserCount: number
  polymarketCloserCount: number
  tieCount: number
  meanCrossSpreadA: number | null
  meanAbsCrossSpreadA: number | null
  meanKalshiErrorA: number | null
  meanPolymarketErrorA: number | null
  kalshiCandidateCount: number
  polymarketCandidateCount: number
  kalshiCandidateCorrectCount: number
  polymarketCandidateCorrectCount: number
}

export interface ResolvedCrossMarketRow {
  capturedAt: string
  matchId: string | null
  teamA: string | null
  teamB: string | null
  tourType: string
  qualityTier: string
  winner: 'teamA' | 'teamB'
  actualA: 0 | 1
  pFairA: number
  kalshiLastA: number | null
  polymarketLastA: number | null
  kalshiErrorA: number | null
  polymarketErrorA: number | null
  closerProvider: 'kalshi' | 'polymarket' | 'tie' | 'unknown'
  crossSpreadA: number | null
  kalshiDecision: string | null
  polymarketDecision: string | null
  kalshiCandidateCorrect: boolean | null
  polymarketCandidateCorrect: boolean | null
}

export interface ResolvedCrossMarketStudy {
  version: 'resolved-cross-market-study/v1'
  generatedAt: string
  comparisonCount: number
  resolvedCount: number
  overall: ResolvedCrossMarketBucket
  byTourType: ResolvedCrossMarketBucket[]
  byQualityTier: ResolvedCrossMarketBucket[]
  rows: ResolvedCrossMarketRow[]
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

function candidateCorrect(
  decision: string | null | undefined,
  probA: number | null | undefined,
  actualA: 0 | 1,
): boolean | null {
  if (decision !== 'candidate' && decision !== 'candidate_but_ineligible') return null
  if (typeof probA !== 'number' || !Number.isFinite(probA)) return null
  return actualA === 1 ? probA >= 0.5 : probA < 0.5
}

function toRow(
  comparison: MultiMarketComparison,
  outcomeIndex?: Map<string, ResolvedMatchOutcome>,
): ResolvedCrossMarketRow | null {
  const winner = resolvedWinnerWithOutcome(comparison, outcomeIndex)
  const pFairA = comparison.pFair.match.pMatchA
  if (!winner || typeof pFairA !== 'number' || !Number.isFinite(pFairA)) return null

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
    kalshiLastA,
    polymarketLastA,
    kalshiErrorA,
    polymarketErrorA,
    closerProvider: chooseCloser(kalshiErrorA, polymarketErrorA),
    crossSpreadA: comparison.crossMarket.marketProbA.spreadKalshiMinusPolymarket,
    kalshiDecision: comparison.markets.kalshi?.liveDecision.action ?? null,
    polymarketDecision: comparison.markets.polymarket?.liveDecision.action ?? null,
    kalshiCandidateCorrect: candidateCorrect(
      comparison.markets.kalshi?.liveDecision.action,
      comparison.markets.kalshi?.fairVsMarket.marketProbA.last,
      actualA,
    ),
    polymarketCandidateCorrect: candidateCorrect(
      comparison.markets.polymarket?.liveDecision.action,
      comparison.markets.polymarket?.fairVsMarket.marketProbA.last,
      actualA,
    ),
  }
}

function toBucket(key: string, rows: ResolvedCrossMarketRow[]): ResolvedCrossMarketBucket {
  const crossSpreadA = rows
    .map((row) => row.crossSpreadA)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const kalshiErrorA = rows
    .map((row) => row.kalshiErrorA)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const polymarketErrorA = rows
    .map((row) => row.polymarketErrorA)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  return {
    key,
    sampleCount: rows.length,
    kalshiCloserCount: rows.filter((row) => row.closerProvider === 'kalshi').length,
    polymarketCloserCount: rows.filter((row) => row.closerProvider === 'polymarket').length,
    tieCount: rows.filter((row) => row.closerProvider === 'tie').length,
    meanCrossSpreadA: mean(crossSpreadA),
    meanAbsCrossSpreadA: mean(crossSpreadA.map((value) => Math.abs(value))),
    meanKalshiErrorA: mean(kalshiErrorA),
    meanPolymarketErrorA: mean(polymarketErrorA),
    kalshiCandidateCount: rows.filter((row) => row.kalshiDecision === 'candidate' || row.kalshiDecision === 'candidate_but_ineligible').length,
    polymarketCandidateCount: rows.filter((row) => row.polymarketDecision === 'candidate' || row.polymarketDecision === 'candidate_but_ineligible').length,
    kalshiCandidateCorrectCount: rows.filter((row) => row.kalshiCandidateCorrect === true).length,
    polymarketCandidateCorrectCount: rows.filter((row) => row.polymarketCandidateCorrect === true).length,
  }
}

function bucketize(rows: ResolvedCrossMarketRow[], keyFn: (row: ResolvedCrossMarketRow) => string): ResolvedCrossMarketBucket[] {
  const buckets = new Map<string, ResolvedCrossMarketRow[]>()
  for (const row of rows) {
    const key = keyFn(row)
    const group = buckets.get(key)
    if (group) group.push(row)
    else buckets.set(key, [row])
  }

  return [...buckets.entries()]
    .map(([key, group]) => toBucket(key, group))
    .sort((a, b) => b.sampleCount - a.sampleCount || a.key.localeCompare(b.key))
}

export async function buildResolvedCrossMarketStudy(
  rootDir: string,
  options: { outcomeRootDir?: string | null } = {},
): Promise<ResolvedCrossMarketStudy> {
  const comparisons = await loadMultiMarketComparisons(rootDir)
  const outcomeIndex = options.outcomeRootDir ? await loadResolvedOutcomeIndex(options.outcomeRootDir) : undefined

  const rows = comparisons
    .map((comparison) => toRow(comparison, outcomeIndex))
    .filter((value): value is ResolvedCrossMarketRow => value != null)
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))

  return {
    version: 'resolved-cross-market-study/v1',
    generatedAt: new Date().toISOString(),
    comparisonCount: comparisons.length,
    resolvedCount: rows.length,
    overall: toBucket('overall', rows),
    byTourType: bucketize(rows, (row) => row.tourType),
    byQualityTier: bucketize(rows, (row) => row.qualityTier),
    rows,
  }
}
