import {
  buildExecutionSynthesis,
  type ExecutionSynthesisReport,
  type ExecutionSynthesisRow,
} from './executionSynthesis.js'

export interface PortfolioRiskBudgetPolicy {
  bankrollUsd: number
  maxPortfolioFraction: number
  maxSingleIdeaFraction: number
  maxProviderFraction: number
}

export interface PortfolioAllocationRow {
  capturedAt: string
  matchId: string | null
  flashscoreMatchUrl: string | null
  teamA: string | null
  teamB: string | null
  provider: 'kalshi' | 'polymarket' | 'unknown'
  action: string
  regimePermitted: boolean
  setupType: string
  riskLevel: string
  regimeTag: string
  requestedFraction: number
  cappedFraction: number
  allocatedFraction: number
  allocatedUsd: number
  maxLossUsd: number
  confidenceTier: string
  executionScore: number | null
  reasons: string[]
}

export interface PortfolioRiskBudgetReport {
  version: 'portfolio-risk-budget/v1'
  generatedAt: string
  policy: PortfolioRiskBudgetPolicy
  synthesisCount: number
  candidateCount: number
  allocatedCount: number
  totalRequestedFraction: number
  totalAllocatedFraction: number
  totalAllocatedUsd: number
  providerAllocatedFraction: Record<'kalshi' | 'polymarket' | 'unknown', number>
  allocations: PortfolioAllocationRow[]
}

export const DEFAULT_PORTFOLIO_RISK_BUDGET_POLICY: PortfolioRiskBudgetPolicy = {
  bankrollUsd: 100000,
  maxPortfolioFraction: 0.02,
  maxSingleIdeaFraction: 0.01,
  maxProviderFraction: 0.0125,
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function candidateRows(rows: ExecutionSynthesisRow[]): ExecutionSynthesisRow[] {
  return rows.filter((row) => row.regimePolicy.permitted && row.regimePolicy.action === 'execute' && row.primaryLeg)
}

function requestedFractionFor(row: ExecutionSynthesisRow): number {
  return row.positionSizingPolicy.bankrollFraction
}

function buildBaseAllocationRow(
  row: ExecutionSynthesisRow,
  policy: PortfolioRiskBudgetPolicy,
): PortfolioAllocationRow {
  const requestedFraction = requestedFractionFor(row)
  const cappedFraction = clamp(requestedFraction, 0, policy.maxSingleIdeaFraction)
  return {
    capturedAt: row.capturedAt,
    matchId: row.matchId,
    flashscoreMatchUrl: row.flashscoreMatchUrl,
    teamA: row.teamA,
    teamB: row.teamB,
    provider: row.primaryLeg?.provider ?? 'unknown',
    action: row.action,
    regimePermitted: row.regimePolicy.permitted,
    setupType: row.setupType,
    riskLevel: row.riskLevel,
    regimeTag: row.regimeTag,
    requestedFraction,
    cappedFraction,
    allocatedFraction: 0,
    allocatedUsd: 0,
    maxLossUsd: 0,
    confidenceTier: row.positionSizingPolicy.confidenceTier,
    executionScore: row.primaryLeg?.executionScore ?? null,
    reasons: [
      ...row.regimePolicy.reasons,
      ...row.positionSizingPolicy.reasons,
    ],
  }
}

function sortAllocations(rows: PortfolioAllocationRow[]): PortfolioAllocationRow[] {
  return [...rows].sort((a, b) =>
    (b.executionScore ?? -Infinity) - (a.executionScore ?? -Infinity) ||
    b.cappedFraction - a.cappedFraction ||
    a.capturedAt.localeCompare(b.capturedAt),
  )
}

export async function buildPortfolioRiskBudget(
  rootDir: string,
  options: {
    policy?: Partial<PortfolioRiskBudgetPolicy>
    includeWatchOnly?: boolean
    includeBlocked?: boolean
    rankingLimit?: number
  } = {},
): Promise<PortfolioRiskBudgetReport> {
  const policy = { ...DEFAULT_PORTFOLIO_RISK_BUDGET_POLICY, ...(options.policy || {}) }
  const synthesis: ExecutionSynthesisReport = await buildExecutionSynthesis(rootDir, {
    includeWatchOnly: options.includeWatchOnly,
    includeBlocked: options.includeBlocked,
    rankingLimit: options.rankingLimit,
  })

  const candidates = candidateRows(synthesis.rows).map((row) => buildBaseAllocationRow(row, policy))
  const sorted = sortAllocations(candidates)
  let portfolioRemaining = policy.maxPortfolioFraction
  const providerRemaining: Record<'kalshi' | 'polymarket' | 'unknown', number> = {
    kalshi: policy.maxProviderFraction,
    polymarket: policy.maxProviderFraction,
    unknown: policy.maxProviderFraction,
  }

  const allocations = sorted.map((row) => {
    const providerCap = providerRemaining[row.provider]
    const allocatedFraction = round(Math.max(0, Math.min(row.cappedFraction, portfolioRemaining, providerCap)))
    portfolioRemaining = round(Math.max(0, portfolioRemaining - allocatedFraction))
    providerRemaining[row.provider] = round(Math.max(0, providerRemaining[row.provider] - allocatedFraction))
    const allocatedUsd = Math.round(policy.bankrollUsd * allocatedFraction)
    const maxLossUsd = Math.round(allocatedUsd * 0.35)

    return {
      ...row,
      allocatedFraction,
      allocatedUsd,
      maxLossUsd,
    }
  })

  return {
    version: 'portfolio-risk-budget/v1',
    generatedAt: new Date().toISOString(),
    policy,
    synthesisCount: synthesis.rowCount,
    candidateCount: candidates.length,
    allocatedCount: allocations.filter((row) => row.allocatedFraction > 0).length,
    totalRequestedFraction: round(candidates.reduce((sum, row) => sum + row.requestedFraction, 0)),
    totalAllocatedFraction: round(allocations.reduce((sum, row) => sum + row.allocatedFraction, 0)),
    totalAllocatedUsd: allocations.reduce((sum, row) => sum + row.allocatedUsd, 0),
    providerAllocatedFraction: {
      kalshi: round(allocations.filter((row) => row.provider === 'kalshi').reduce((sum, row) => sum + row.allocatedFraction, 0)),
      polymarket: round(allocations.filter((row) => row.provider === 'polymarket').reduce((sum, row) => sum + row.allocatedFraction, 0)),
      unknown: round(allocations.filter((row) => row.provider === 'unknown').reduce((sum, row) => sum + row.allocatedFraction, 0)),
    },
    allocations,
  }
}
