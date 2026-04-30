import { findResolvedOutcome, loadResolvedOutcomeIndex, type ResolvedMatchOutcome } from './resolvedOutcome.js'
import {
  buildExecutionSynthesis,
  type ExecutionRegimeTag,
  type ExecutionRiskLevel,
  type ExecutionSynthesisAction,
  type ExecutionSynthesisRow,
} from './executionSynthesis.js'

export interface ResolvedExecutionAuditRow {
  capturedAt: string
  matchId: string | null
  flashscoreMatchUrl: string | null
  teamA: string | null
  teamB: string | null
  tourType: string
  qualityTier: string
  winner: 'teamA' | 'teamB'
  actualA: 0 | 1
  action: ExecutionSynthesisAction
  riskLevel: ExecutionRiskLevel
  regimeTag: ExecutionRegimeTag
  regimePermitted: boolean
  setupType: string
  primaryProvider: 'kalshi' | 'polymarket' | 'unknown'
  side: 'teamA' | 'teamB' | 'none'
  pFairSide: number | null
  marketLastSide: number | null
  edgeVsLastSide: number | null
  executionScore: number | null
  bankrollFraction: number
  confidenceTier: string
  correctDirection: boolean | null
}

export interface ResolvedExecutionAuditBucket {
  key: string
  sampleCount: number
  permittedCount: number
  executeCount: number
  correctDirectionCount: number
  correctDirectionRate: number | null
  permittedCorrectCount: number
  permittedCorrectRate: number | null
  meanEdgeVsLastSide: number | null
  meanExecutionScore: number | null
  meanBankrollFraction: number | null
}

export interface ResolvedExecutionAudit {
  version: 'resolved-execution-audit/v1'
  generatedAt: string
  synthesisCount: number
  resolvedCount: number
  overall: ResolvedExecutionAuditBucket
  byAction: ResolvedExecutionAuditBucket[]
  byRegimeTag: ResolvedExecutionAuditBucket[]
  byPrimaryProvider: ResolvedExecutionAuditBucket[]
  rows: ResolvedExecutionAuditRow[]
}

function mean(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function correctDirection(side: 'teamA' | 'teamB' | 'none', actualA: 0 | 1): boolean | null {
  if (side === 'none') return null
  return side === 'teamA' ? actualA === 1 : actualA === 0
}

function toBucket(key: string, rows: ResolvedExecutionAuditRow[]): ResolvedExecutionAuditBucket {
  const directionRows = rows.filter((row) => row.correctDirection != null)
  const permittedRows = rows.filter((row) => row.regimePermitted && row.correctDirection != null)
  const edgeValues = rows
    .map((row) => row.edgeVsLastSide)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const scoreValues = rows
    .map((row) => row.executionScore)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  const bankrollValues = rows
    .map((row) => row.bankrollFraction)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  return {
    key,
    sampleCount: rows.length,
    permittedCount: rows.filter((row) => row.regimePermitted).length,
    executeCount: rows.filter((row) => row.action === 'execute').length,
    correctDirectionCount: directionRows.filter((row) => row.correctDirection === true).length,
    correctDirectionRate: directionRows.length
      ? directionRows.filter((row) => row.correctDirection === true).length / directionRows.length
      : null,
    permittedCorrectCount: permittedRows.filter((row) => row.correctDirection === true).length,
    permittedCorrectRate: permittedRows.length
      ? permittedRows.filter((row) => row.correctDirection === true).length / permittedRows.length
      : null,
    meanEdgeVsLastSide: mean(edgeValues),
    meanExecutionScore: mean(scoreValues),
    meanBankrollFraction: mean(bankrollValues),
  }
}

function bucketize(rows: ResolvedExecutionAuditRow[], keyFn: (row: ResolvedExecutionAuditRow) => string): ResolvedExecutionAuditBucket[] {
  const groups = new Map<string, ResolvedExecutionAuditRow[]>()
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

function rowToAuditRow(
  row: ExecutionSynthesisRow,
  outcome: ResolvedMatchOutcome,
): ResolvedExecutionAuditRow {
  const actualA: 0 | 1 = outcome.winner === 'teamA' ? 1 : 0
  const side = row.primaryLeg?.side ?? 'none'

  return {
    capturedAt: row.capturedAt,
    matchId: row.matchId,
    flashscoreMatchUrl: row.flashscoreMatchUrl,
    teamA: row.teamA,
    teamB: row.teamB,
    tourType: row.tourType,
    qualityTier: row.qualityTier,
    winner: outcome.winner,
    actualA,
    action: row.action,
    riskLevel: row.riskLevel,
    regimeTag: row.regimeTag,
    regimePermitted: row.regimePolicy.permitted,
    setupType: row.setupType,
    primaryProvider: row.primaryLeg?.provider ?? 'unknown',
    side,
    pFairSide: row.primaryLeg?.pFairSide ?? null,
    marketLastSide: row.primaryLeg?.marketLastSide ?? null,
    edgeVsLastSide: row.primaryLeg?.edgeVsLastSide ?? null,
    executionScore: row.primaryLeg?.executionScore ?? null,
    bankrollFraction: row.positionSizingPolicy.bankrollFraction,
    confidenceTier: row.positionSizingPolicy.confidenceTier,
    correctDirection: correctDirection(side, actualA),
  }
}

export async function buildResolvedExecutionAudit(
  rootDir: string,
  options: {
    outcomeRootDir: string
    includeWatchOnly?: boolean
    includeBlocked?: boolean
    rankingLimit?: number
  },
): Promise<ResolvedExecutionAudit> {
  const synthesis = await buildExecutionSynthesis(rootDir, {
    includeWatchOnly: options.includeWatchOnly,
    includeBlocked: options.includeBlocked,
    rankingLimit: options.rankingLimit,
  })
  const outcomeIndex = await loadResolvedOutcomeIndex(options.outcomeRootDir)

  const rows = synthesis.rows
    .map((row) => {
      const outcome = findResolvedOutcome(outcomeIndex, {
        matchId: row.matchId,
        flashscoreMatchUrl: row.flashscoreMatchUrl,
      })
      if (!outcome || outcome.status !== 'FINAL') return null
      return rowToAuditRow(row, outcome)
    })
    .filter((row): row is ResolvedExecutionAuditRow => row != null)
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))

  return {
    version: 'resolved-execution-audit/v1',
    generatedAt: new Date().toISOString(),
    synthesisCount: synthesis.rowCount,
    resolvedCount: rows.length,
    overall: toBucket('overall', rows),
    byAction: bucketize(rows, (row) => row.action),
    byRegimeTag: bucketize(rows, (row) => row.regimeTag),
    byPrimaryProvider: bucketize(rows, (row) => row.primaryProvider),
    rows,
  }
}
