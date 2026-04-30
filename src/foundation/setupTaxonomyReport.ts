import { loadMultiMarketComparisons } from './multiMarketReport.js'
import { classifyTradeSetup, type TradeSetupType } from './setupTaxonomy.js'

export interface SetupTaxonomyBucket {
  key: string
  sampleCount: number
  directCount: number
  blockedCount: number
  meanAbsCrossSpreadA: number | null
  meanAbsKalshiEdgeA: number | null
  meanAbsPolymarketEdgeA: number | null
}

export interface SetupTaxonomyResolvedRow {
  capturedAt: string
  matchId: string | null
  teamA: string | null
  teamB: string | null
  setupType: TradeSetupType
  primaryProvider: 'kalshi' | 'polymarket' | 'none'
  side: 'teamA' | 'teamB' | 'none'
}

export interface SetupTaxonomyReport {
  version: 'setup-taxonomy-report/v1'
  generatedAt: string
  comparisonCount: number
  overallBySetup: SetupTaxonomyBucket[]
  byTourType: SetupTaxonomyBucket[]
  byQualityTier: SetupTaxonomyBucket[]
  rows: SetupTaxonomyResolvedRow[]
}

interface ClassifiedRow extends SetupTaxonomyResolvedRow {
  crossSpreadA: number | null
  kalshiEdgeA: number | null
  polymarketEdgeA: number | null
}

function mean(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function toBucket(key: string, rows: ClassifiedRow[]): SetupTaxonomyBucket {
  const spreads = rows.map((row) => row.crossSpreadA).filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const kalshiEdges = rows.map((row) => row.kalshiEdgeA).filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const polymarketEdges = rows.map((row) => row.polymarketEdgeA).filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  return {
    key,
    sampleCount: rows.length,
    directCount: rows.filter((row) => row.setupType.startsWith('single_market_') || row.setupType.startsWith('cross_market_')).length,
    blockedCount: rows.filter((row) => row.setupType === 'blocked_candidate').length,
    meanAbsCrossSpreadA: mean(spreads.map((value) => Math.abs(value))),
    meanAbsKalshiEdgeA: mean(kalshiEdges.map((value) => Math.abs(value))),
    meanAbsPolymarketEdgeA: mean(polymarketEdges.map((value) => Math.abs(value))),
  }
}

function bucketize(rows: ClassifiedRow[], keyFn: (row: ClassifiedRow) => string): SetupTaxonomyBucket[] {
  const groups = new Map<string, ClassifiedRow[]>()
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

export async function buildSetupTaxonomyReport(rootDir: string): Promise<SetupTaxonomyReport> {
  const comparisons = await loadMultiMarketComparisons(rootDir)
  const rows: ClassifiedRow[] = comparisons
    .map((comparison) => {
      const setup = classifyTradeSetup(comparison)
      return {
        capturedAt: comparison.capturedAt,
        matchId: comparison.match.matchId,
        teamA: comparison.match.teamA,
        teamB: comparison.match.teamB,
        setupType: setup.type,
        primaryProvider: setup.primaryProvider,
        side: setup.side,
        crossSpreadA: comparison.crossMarket.marketProbA.spreadKalshiMinusPolymarket,
        kalshiEdgeA: comparison.markets.kalshi?.fairVsMarket.edgeA.vsLast ?? null,
        polymarketEdgeA: comparison.markets.polymarket?.fairVsMarket.edgeA.vsLast ?? null,
      }
    })
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))

  return {
    version: 'setup-taxonomy-report/v1',
    generatedAt: new Date().toISOString(),
    comparisonCount: rows.length,
    overallBySetup: bucketize(rows, (row) => row.setupType),
    byTourType: bucketize(rows, (row) => `${row.setupType}:${comparisons.find((comparison) => comparison.capturedAt === row.capturedAt && comparison.match.matchId === row.matchId)?.prematchBaseline?.tourType || 'UNKNOWN'}`),
    byQualityTier: bucketize(rows, (row) => `${row.setupType}:${comparisons.find((comparison) => comparison.capturedAt === row.capturedAt && comparison.match.matchId === row.matchId)?.quality.tier || 'unknown'}`),
    rows: rows.map(({ crossSpreadA: _crossSpreadA, kalshiEdgeA: _kalshiEdgeA, polymarketEdgeA: _polymarketEdgeA, ...rest }) => rest),
  }
}
