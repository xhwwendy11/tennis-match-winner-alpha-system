import { findResolvedOutcome, loadResolvedOutcomeIndex, type ResolvedMatchOutcome } from './resolvedOutcome.js'
import {
  buildPortfolioRiskBudget,
  type PortfolioAllocationRow,
  type PortfolioRiskBudgetPolicy,
} from './portfolioRiskBudget.js'

export interface PortfolioAuditRow {
  capturedAt: string
  matchId: string | null
  flashscoreMatchUrl: string | null
  teamA: string | null
  teamB: string | null
  provider: 'kalshi' | 'polymarket' | 'unknown'
  setupType: string
  riskLevel: string
  regimeTag: string
  winner: 'teamA' | 'teamB'
  allocatedFraction: number
  allocatedUsd: number
  maxLossUsd: number
  confidenceTier: string
  side: 'teamA' | 'teamB' | 'none'
  correctDirection: boolean | null
}

export interface PortfolioAuditBucket {
  key: string
  sampleCount: number
  allocatedCount: number
  correctDirectionCount: number
  correctDirectionRate: number | null
  allocatedUsd: number
  correctAllocatedUsd: number
  weightedCorrectRateByUsd: number | null
  meanAllocatedFraction: number | null
}

export interface PortfolioAuditReport {
  version: 'portfolio-audit/v1'
  generatedAt: string
  policy: PortfolioRiskBudgetPolicy
  allocationCount: number
  resolvedCount: number
  overall: PortfolioAuditBucket
  byProvider: PortfolioAuditBucket[]
  byRiskLevel: PortfolioAuditBucket[]
  byRegimeTag: PortfolioAuditBucket[]
  rows: PortfolioAuditRow[]
}

function mean(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function inferredSide(row: PortfolioAllocationRow): 'teamA' | 'teamB' | 'none' {
  if (row.setupType.endsWith('teamA')) return 'teamA'
  if (row.setupType.endsWith('teamB')) return 'teamB'
  return 'none'
}

function correctDirection(side: 'teamA' | 'teamB' | 'none', winner: 'teamA' | 'teamB'): boolean | null {
  if (side === 'none') return null
  return side === winner
}

function toAuditRow(
  row: PortfolioAllocationRow,
  outcome: ResolvedMatchOutcome,
): PortfolioAuditRow {
  const side = inferredSide(row)
  return {
    capturedAt: row.capturedAt,
    matchId: row.matchId,
    flashscoreMatchUrl: row.flashscoreMatchUrl,
    teamA: row.teamA,
    teamB: row.teamB,
    provider: row.provider,
    setupType: row.setupType,
    riskLevel: row.riskLevel,
    regimeTag: row.regimeTag,
    winner: outcome.winner,
    allocatedFraction: row.allocatedFraction,
    allocatedUsd: row.allocatedUsd,
    maxLossUsd: row.maxLossUsd,
    confidenceTier: row.confidenceTier,
    side,
    correctDirection: correctDirection(side, outcome.winner),
  }
}

function toBucket(key: string, rows: PortfolioAuditRow[]): PortfolioAuditBucket {
  const directionRows = rows.filter((row) => row.correctDirection != null)
  const allocatedUsd = rows.reduce((sum, row) => sum + row.allocatedUsd, 0)
  const correctAllocatedUsd = rows
    .filter((row) => row.correctDirection === true)
    .reduce((sum, row) => sum + row.allocatedUsd, 0)

  return {
    key,
    sampleCount: rows.length,
    allocatedCount: rows.filter((row) => row.allocatedUsd > 0).length,
    correctDirectionCount: directionRows.filter((row) => row.correctDirection === true).length,
    correctDirectionRate: directionRows.length
      ? directionRows.filter((row) => row.correctDirection === true).length / directionRows.length
      : null,
    allocatedUsd,
    correctAllocatedUsd,
    weightedCorrectRateByUsd: allocatedUsd > 0 ? correctAllocatedUsd / allocatedUsd : null,
    meanAllocatedFraction: mean(rows.map((row) => row.allocatedFraction)),
  }
}

function bucketize(rows: PortfolioAuditRow[], keyFn: (row: PortfolioAuditRow) => string): PortfolioAuditBucket[] {
  const groups = new Map<string, PortfolioAuditRow[]>()
  for (const row of rows) {
    const key = keyFn(row)
    const bucket = groups.get(key)
    if (bucket) bucket.push(row)
    else groups.set(key, [row])
  }

  return [...groups.entries()]
    .map(([key, group]) => toBucket(key, group))
    .sort((a, b) => b.sampleCount - a.sampleCount || a.key.localeCompare(b.key))
}

export async function buildPortfolioAudit(
  rootDir: string,
  options: {
    outcomeRootDir: string
    policy?: Partial<PortfolioRiskBudgetPolicy>
    includeWatchOnly?: boolean
    includeBlocked?: boolean
    rankingLimit?: number
  },
): Promise<PortfolioAuditReport> {
  const budget = await buildPortfolioRiskBudget(rootDir, {
    policy: options.policy,
    includeWatchOnly: options.includeWatchOnly,
    includeBlocked: options.includeBlocked,
    rankingLimit: options.rankingLimit,
  })
  const outcomeIndex = await loadResolvedOutcomeIndex(options.outcomeRootDir)

  const rows = budget.allocations
    .filter((row) => row.allocatedUsd > 0)
    .map((row) => {
      const outcome = findResolvedOutcome(outcomeIndex, {
        matchId: row.matchId,
        flashscoreMatchUrl: row.flashscoreMatchUrl,
      })
      if (!outcome || outcome.status !== 'FINAL') return null
      return toAuditRow(row, outcome)
    })
    .filter((row): row is PortfolioAuditRow => row != null)
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))

  return {
    version: 'portfolio-audit/v1',
    generatedAt: new Date().toISOString(),
    policy: budget.policy,
    allocationCount: budget.allocatedCount,
    resolvedCount: rows.length,
    overall: toBucket('overall', rows),
    byProvider: bucketize(rows, (row) => row.provider),
    byRiskLevel: bucketize(rows, (row) => row.riskLevel),
    byRegimeTag: bucketize(rows, (row) => row.regimeTag),
    rows,
  }
}
