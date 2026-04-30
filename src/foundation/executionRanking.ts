import { buildLabeledExecutionDataset, type LabeledExecutionDatasetRow } from './labeledExecutionDataset.js'

export interface ExecutionRankingWeights {
  directCandidateBonus: number
  blockedCandidatePenalty: number
  watchOnlyPenalty: number
  marketEligibleBonus: number
  blockedReasonPenalty: number
  lowQualityPenalty: number
  mediumQualityPenalty: number
  unusableQualityPenalty: number
  directCandidateGateBonus: number
  watchOnlyGatePenalty: number
  blockedGatePenalty: number
  ineligibleGatePenalty: number
  edgeWeight: number
  crossSpreadWeight: number
  spreadPenaltyWeight: number
  passiveTouchBonus: number
  passiveFillBeforeAdverseBonus: number
  adverseBeforePassivePenalty: number
  futureCoverageWeight: number
}

export interface ExecutionRankingRow {
  capturedAt: string
  matchId: string | null
  flashscoreMatchUrl: string | null
  provider: 'kalshi' | 'polymarket'
  providerUrl: string | null
  teamA: string | null
  teamB: string | null
  tourType: string
  qualityTier: string
  setupType: string
  legRole: string
  actionability: string
  side: 'teamA' | 'teamB'
  marketEligible: boolean
  edgeVsLastSide: number | null
  crossSpreadSameSide: number | null
  spreadSide: number | null
  futureCaptureCount: number
  passiveTouch: boolean | null
  passiveFillBeforeAdverse: boolean | null
  adverseMoveBeforePassive: boolean | null
  researchScore: number
  executionScore: number
  executionEligible: boolean
  scoreBreakdown: {
    gate: number
    baseActionability: number
    marketEligibility: number
    blockedReasons: number
    quality: number
    edge: number
    crossSpread: number
    spreadPenalty: number
    passiveTouch: number
    passiveFillBeforeAdverse: number
    adverseBeforePassive: number
    futureCoverage: number
  }
}

export interface ExecutionRankingReport {
  version: 'execution-ranking-report/v1'
  generatedAt: string
  rowCount: number
  rankedCount: number
  topRows: ExecutionRankingRow[]
  byProviderTop: Record<'kalshi' | 'polymarket', ExecutionRankingRow[]>
}

export const DEFAULT_EXECUTION_RANKING_WEIGHTS: ExecutionRankingWeights = {
  directCandidateBonus: 40,
  blockedCandidatePenalty: -20,
  watchOnlyPenalty: -10,
  marketEligibleBonus: 10,
  blockedReasonPenalty: -4,
  lowQualityPenalty: -25,
  mediumQualityPenalty: -5,
  unusableQualityPenalty: -100,
  directCandidateGateBonus: 25,
  watchOnlyGatePenalty: -40,
  blockedGatePenalty: -50,
  ineligibleGatePenalty: -30,
  edgeWeight: 120,
  crossSpreadWeight: 40,
  spreadPenaltyWeight: 60,
  passiveTouchBonus: 25,
  passiveFillBeforeAdverseBonus: 35,
  adverseBeforePassivePenalty: -30,
  futureCoverageWeight: 2,
}

function n(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

function qualityAdjustment(
  qualityTier: string,
  weights: ExecutionRankingWeights,
): number {
  if (qualityTier === 'unusable') return weights.unusableQualityPenalty
  if (qualityTier === 'low') return weights.lowQualityPenalty
  if (qualityTier === 'medium') return weights.mediumQualityPenalty
  return 0
}

function executionGateAdjustment(
  row: LabeledExecutionDatasetRow,
  weights: ExecutionRankingWeights,
): number {
  let value = 0
  if (row.actionability === 'direct_candidate') value += weights.directCandidateGateBonus
  else if (row.actionability === 'blocked_candidate') value += weights.blockedGatePenalty
  else value += weights.watchOnlyGatePenalty

  if (!row.marketEligible) value += weights.ineligibleGatePenalty
  return value
}

export function scoreExecutionRow(
  row: LabeledExecutionDatasetRow,
  weights: ExecutionRankingWeights = DEFAULT_EXECUTION_RANKING_WEIGHTS,
): ExecutionRankingRow {
  const baseActionability =
    row.actionability === 'direct_candidate'
      ? weights.directCandidateBonus
      : row.actionability === 'blocked_candidate'
        ? weights.blockedCandidatePenalty
        : weights.watchOnlyPenalty

  const marketEligibility = row.marketEligible ? weights.marketEligibleBonus : 0
  const blockedReasons = -(row.blockedBy.length * Math.abs(weights.blockedReasonPenalty))
  const quality = qualityAdjustment(row.qualityTier, weights)
  const gate = executionGateAdjustment(row, weights)
  const edge = Math.abs(n(row.edgeVsLastSide)) * weights.edgeWeight
  const crossSpread = Math.abs(n(row.crossSpreadSameSide)) * weights.crossSpreadWeight
  const spreadPenalty = -Math.abs(n(row.spreadSide)) * weights.spreadPenaltyWeight
  const passiveTouch = row.executionLabels.passiveTouch === true ? weights.passiveTouchBonus : 0
  const passiveFillBeforeAdverse =
    row.executionLabels.passiveFillBeforeAdverse === true ? weights.passiveFillBeforeAdverseBonus : 0
  const adverseBeforePassive =
    row.executionLabels.adverseMoveBeforePassive === true ? weights.adverseBeforePassivePenalty : 0
  const futureCoverage = Math.min(row.executionLabels.futureCaptureCount, 10) * weights.futureCoverageWeight

  const researchScore = round(
    baseActionability +
      marketEligibility +
      blockedReasons +
      quality +
      edge +
      crossSpread +
      spreadPenalty +
      passiveTouch +
      passiveFillBeforeAdverse +
      adverseBeforePassive +
      futureCoverage,
  )
  const executionEligible = row.actionability === 'direct_candidate' && row.marketEligible && row.qualityTier === 'high'
  const executionScore = round(researchScore + gate)

  return {
    capturedAt: row.capturedAt,
    matchId: row.matchId,
    flashscoreMatchUrl: row.flashscoreMatchUrl,
    provider: row.provider,
    providerUrl: row.providerUrl,
    teamA: row.teamA,
    teamB: row.teamB,
    tourType: row.tourType,
    qualityTier: row.qualityTier,
    setupType: row.setupType,
    legRole: row.legRole,
    actionability: row.actionability,
    side: row.side,
    marketEligible: row.marketEligible,
    edgeVsLastSide: row.edgeVsLastSide,
    crossSpreadSameSide: row.crossSpreadSameSide,
    spreadSide: row.spreadSide,
    futureCaptureCount: row.executionLabels.futureCaptureCount,
    passiveTouch: row.executionLabels.passiveTouch,
    passiveFillBeforeAdverse: row.executionLabels.passiveFillBeforeAdverse,
    adverseMoveBeforePassive: row.executionLabels.adverseMoveBeforePassive,
    researchScore,
    executionScore,
    executionEligible,
    scoreBreakdown: {
      gate: round(gate),
      baseActionability: round(baseActionability),
      marketEligibility: round(marketEligibility),
      blockedReasons: round(blockedReasons),
      quality: round(quality),
      edge: round(edge),
      crossSpread: round(crossSpread),
      spreadPenalty: round(spreadPenalty),
      passiveTouch: round(passiveTouch),
      passiveFillBeforeAdverse: round(passiveFillBeforeAdverse),
      adverseBeforePassive: round(adverseBeforePassive),
      futureCoverage: round(futureCoverage),
    },
  }
}

export async function buildExecutionRankingReport(
  rootDir: string,
  options: {
    includeWatchOnly?: boolean
    includeBlocked?: boolean
    limit?: number
    weights?: Partial<ExecutionRankingWeights>
  } = {},
): Promise<ExecutionRankingReport> {
  const weights = { ...DEFAULT_EXECUTION_RANKING_WEIGHTS, ...(options.weights || {}) }
  const dataset = await buildLabeledExecutionDataset(rootDir, {
    includeWatchOnly: options.includeWatchOnly,
    includeBlocked: options.includeBlocked,
  })
  const ranked = dataset.rows
    .map((row) => scoreExecutionRow(row, weights))
    .sort((a, b) => b.executionScore - a.executionScore || b.researchScore - a.researchScore || a.capturedAt.localeCompare(b.capturedAt))

  const limit = options.limit ?? 25
  const topRows = ranked.slice(0, limit)
  const byProviderTop = {
    kalshi: ranked.filter((row) => row.provider === 'kalshi').slice(0, limit),
    polymarket: ranked.filter((row) => row.provider === 'polymarket').slice(0, limit),
  }

  return {
    version: 'execution-ranking-report/v1',
    generatedAt: new Date().toISOString(),
    rowCount: dataset.rowCount,
    rankedCount: ranked.length,
    topRows,
    byProviderTop,
  }
}
