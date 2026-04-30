import {
  buildLabeledExecutionDataset,
  type LabeledExecutionDataset,
  type LabeledExecutionDatasetRow,
} from './labeledExecutionDataset.js'
import {
  buildExecutionRankingReport,
  type ExecutionRankingReport,
  type ExecutionRankingRow,
} from './executionRanking.js'
import { buildRecapturePathReport, type RecapturePathSummary } from './recapturePathReport.js'

export type ExecutionSynthesisAction = 'execute' | 'research_only' | 'ignore'
export type ExecutionRiskLevel = 'low' | 'medium' | 'high' | 'extreme'
export type PositionSizingHint = 'full' | 'half' | 'quarter' | 'none'
export type ExecutionRegimeTag =
  | 'single_snapshot'
  | 'stable_dislocation'
  | 'volatile_dislocation'
  | 'cross_market_flip'
  | 'action_transitioning'

export interface RegimeConditionedExecutionPolicy {
  action: ExecutionSynthesisAction
  sizingHint: PositionSizingHint
  permitted: boolean
  reasons: string[]
}

export interface PositionSizingPolicy {
  sizingHint: PositionSizingHint
  bankrollFraction: number
  maxPositionUsdPer100kBankroll: number
  maxLegUsdPer100kBankroll: number
  maxLossUsdPer100kBankroll: number
  confidenceTier: 'none' | 'pilot' | 'reduced' | 'standard'
  reasons: string[]
}

export interface ExecutionSynthesisLeg {
  provider: 'kalshi' | 'polymarket'
  providerUrl: string | null
  side: 'teamA' | 'teamB'
  legRole: string
  actionability: string
  marketEligible: boolean
  setupType: string
  pFairSide: number | null
  marketLastSide: number | null
  edgeVsLastSide: number | null
  crossSpreadSameSide: number | null
  spreadSide: number | null
  passivePrice: number | null
  aggressivePrice: number | null
  futureCaptureCount: number
  passiveTouch: boolean | null
  passiveFillBeforeAdverse: boolean | null
  adverseMoveBeforePassive: boolean | null
  researchScore: number
  executionScore: number
  executionEligible: boolean
}

export interface ExecutionSynthesisRow {
  capturedAt: string
  matchId: string | null
  flashscoreMatchUrl: string | null
  teamA: string | null
  teamB: string | null
  tourType: string
  qualityTier: string
  setupType: string
  action: ExecutionSynthesisAction
  riskLevel: ExecutionRiskLevel
  sizingHint: PositionSizingHint
  regimeTag: ExecutionRegimeTag
  pathContext: {
    captureCount: number
    durationSeconds: number
    bothAvailableCount: number
    crossMarketRangeA: number | null
    crossMarketSignChangeCount: number
    kalshiActionTransitionCount: number
    polymarketActionTransitionCount: number
  }
  regimePolicy: RegimeConditionedExecutionPolicy
  positionSizingPolicy: PositionSizingPolicy
  shortlistEligible: boolean
  executionEligibleLegCount: number
  primaryLeg: ExecutionSynthesisLeg | null
  supportingLegs: ExecutionSynthesisLeg[]
  reason: string
}

export interface ExecutionSynthesisReport {
  version: 'execution-synthesis/v1'
  generatedAt: string
  comparisonCount: number
  rowCount: number
  actionCounts: Record<ExecutionSynthesisAction, number>
  riskCounts: Record<ExecutionRiskLevel, number>
  rows: ExecutionSynthesisRow[]
}

interface JoinedLeg {
  ranking: ExecutionRankingRow
  labeled: LabeledExecutionDatasetRow
}

function keyForParts(input: {
  capturedAt: string
  matchId: string | null
  flashscoreMatchUrl: string | null
  provider: 'kalshi' | 'polymarket'
  side: 'teamA' | 'teamB'
  setupType: string
  legRole: string
}): string {
  return [
    input.capturedAt,
    input.matchId || '',
    input.flashscoreMatchUrl || '',
    input.provider,
    input.side,
    input.setupType,
    input.legRole,
  ].join('||')
}

function comparisonKey(input: {
  capturedAt: string
  matchId: string | null
  flashscoreMatchUrl: string | null
}): string {
  return [input.capturedAt, input.matchId || '', input.flashscoreMatchUrl || ''].join('||')
}

function legFrom(joined: JoinedLeg): ExecutionSynthesisLeg {
  return {
    provider: joined.ranking.provider,
    providerUrl: joined.ranking.providerUrl,
    side: joined.ranking.side,
    legRole: joined.ranking.legRole,
    actionability: joined.ranking.actionability,
    marketEligible: joined.ranking.marketEligible,
    setupType: joined.ranking.setupType,
    pFairSide: joined.labeled.pFairSide,
    marketLastSide: joined.labeled.marketLastSide,
    edgeVsLastSide: joined.labeled.edgeVsLastSide,
    crossSpreadSameSide: joined.labeled.crossSpreadSameSide,
    spreadSide: joined.labeled.spreadSide,
    passivePrice: joined.labeled.quoteHypotheses.passivePrice,
    aggressivePrice: joined.labeled.quoteHypotheses.aggressivePrice,
    futureCaptureCount: joined.ranking.futureCaptureCount,
    passiveTouch: joined.ranking.passiveTouch,
    passiveFillBeforeAdverse: joined.ranking.passiveFillBeforeAdverse,
    adverseMoveBeforePassive: joined.ranking.adverseMoveBeforePassive,
    researchScore: joined.ranking.researchScore,
    executionScore: joined.ranking.executionScore,
    executionEligible: joined.ranking.executionEligible,
  }
}

function pathKeyForRow(input: {
  matchId: string | null
  flashscoreMatchUrl: string | null
  teamA: string | null
  teamB: string | null
}): string {
  return (
    input.flashscoreMatchUrl ||
    input.matchId ||
    `${input.teamA || 'unknown'}__${input.teamB || 'unknown'}`
  )
}

function inferAction(legs: JoinedLeg[]): ExecutionSynthesisAction {
  if (legs.some((leg) => leg.ranking.executionEligible)) return 'execute'
  if (legs.some((leg) => leg.ranking.actionability === 'direct_candidate' || leg.ranking.actionability === 'blocked_candidate')) {
    return 'research_only'
  }
  if (legs.some((leg) => leg.ranking.actionability === 'watch_only')) return 'research_only'
  return 'ignore'
}

function inferRiskLevel(legs: JoinedLeg[], action: ExecutionSynthesisAction): ExecutionRiskLevel {
  const primary = legs[0]
  if (!primary) return 'extreme'
  if (primary.ranking.qualityTier === 'unusable' || primary.ranking.qualityTier === 'low') return 'extreme'
  if (action !== 'execute') return primary.ranking.actionability === 'watch_only' ? 'high' : 'medium'
  if (primary.ranking.adverseMoveBeforePassive === true) return 'high'
  if (primary.ranking.qualityTier === 'medium') return 'medium'
  if (primary.ranking.futureCaptureCount === 0) return 'medium'
  return 'low'
}

function inferRegimeTag(path: RecapturePathSummary | null): ExecutionRegimeTag {
  if (!path || path.captureCount <= 1) return 'single_snapshot'
  if (path.crossMarket.signChangeCount > 0) return 'cross_market_flip'
  if (path.kalshi.actionTransitionCount + path.polymarket.actionTransitionCount > 0) return 'action_transitioning'
  if ((path.crossMarket.rangeSpreadA ?? 0) >= 0.08) return 'volatile_dislocation'
  return 'stable_dislocation'
}

function inferSizingHint(primary: JoinedLeg | undefined, action: ExecutionSynthesisAction, riskLevel: ExecutionRiskLevel): PositionSizingHint {
  if (!primary || action !== 'execute') return 'none'
  if (riskLevel === 'extreme') return 'none'
  if (riskLevel === 'high') return 'quarter'
  if (riskLevel === 'medium') return 'half'
  if (primary.ranking.executionScore >= 80) return 'full'
  return 'half'
}

function downgradeSizing(current: PositionSizingHint): PositionSizingHint {
  if (current === 'full') return 'half'
  if (current === 'half') return 'quarter'
  return 'none'
}

function applyRegimePolicy(input: {
  action: ExecutionSynthesisAction
  sizingHint: PositionSizingHint
  riskLevel: ExecutionRiskLevel
  regimeTag: ExecutionRegimeTag
  pathContext: ExecutionSynthesisRow['pathContext']
}): RegimeConditionedExecutionPolicy {
  let action = input.action
  let sizingHint = input.sizingHint
  const reasons: string[] = []

  if (input.regimeTag === 'cross_market_flip') {
    reasons.push('cross_market_sign_flip')
    action = 'research_only'
    sizingHint = 'none'
  }

  if (input.regimeTag === 'action_transitioning' && action === 'execute') {
    reasons.push('provider_action_transition_detected')
    sizingHint = downgradeSizing(sizingHint)
  }

  if (input.regimeTag === 'single_snapshot' && action === 'execute') {
    reasons.push('single_snapshot_without_regime_confirmation')
    sizingHint = downgradeSizing(sizingHint)
  }

  if ((input.pathContext.crossMarketRangeA ?? 0) >= 0.12 && action === 'execute') {
    reasons.push('wide_cross_market_range')
    sizingHint = downgradeSizing(sizingHint)
  }

  if (input.riskLevel === 'extreme') {
    reasons.push('extreme_risk_level')
    action = 'ignore'
    sizingHint = 'none'
  } else if (input.riskLevel === 'high' && action === 'execute' && sizingHint === 'quarter') {
    reasons.push('high_risk_execution_cap')
  }

  return {
    action,
    sizingHint,
    permitted: action === 'execute',
    reasons,
  }
}

function buildPositionSizingPolicy(input: {
  regimePolicy: RegimeConditionedExecutionPolicy
  riskLevel: ExecutionRiskLevel
  primaryLeg: JoinedLeg | undefined
  supportingLegCount: number
}): PositionSizingPolicy {
  if (!input.primaryLeg || !input.regimePolicy.permitted || input.regimePolicy.action !== 'execute') {
    return {
      sizingHint: 'none',
      bankrollFraction: 0,
      maxPositionUsdPer100kBankroll: 0,
      maxLegUsdPer100kBankroll: 0,
      maxLossUsdPer100kBankroll: 0,
      confidenceTier: 'none',
      reasons: ['execution_not_permitted'],
    }
  }

  let bankrollFraction =
    input.regimePolicy.sizingHint === 'full'
      ? 0.02
      : input.regimePolicy.sizingHint === 'half'
        ? 0.01
        : 0.005

  const reasons = [...input.regimePolicy.reasons]

  if (input.primaryLeg.ranking.adverseMoveBeforePassive === true) {
    bankrollFraction = Math.min(bankrollFraction, 0.005)
    reasons.push('adverse_before_passive_seen')
  }

  if (input.primaryLeg.ranking.futureCaptureCount === 0) {
    bankrollFraction = Math.min(bankrollFraction, 0.005)
    reasons.push('no_future_path_coverage')
  }

  if (input.supportingLegCount > 0) {
    bankrollFraction = Math.min(bankrollFraction, 0.01)
    reasons.push('multi_leg_coordination')
  }

  if (input.riskLevel === 'high') {
    bankrollFraction = Math.min(bankrollFraction, 0.005)
    reasons.push('high_risk_cap')
  } else if (input.riskLevel === 'medium') {
    bankrollFraction = Math.min(bankrollFraction, 0.01)
    reasons.push('medium_risk_cap')
  }

  const roundedFraction = Math.round(bankrollFraction * 10000) / 10000
  const maxPositionUsdPer100kBankroll = Math.round(100000 * roundedFraction)
  const legDivisor = Math.max(1, input.supportingLegCount + 1)
  const maxLegUsdPer100kBankroll = Math.round(maxPositionUsdPer100kBankroll / legDivisor)
  const maxLossUsdPer100kBankroll = Math.round(maxPositionUsdPer100kBankroll * 0.35)
  const confidenceTier =
    roundedFraction >= 0.02 ? 'standard' : roundedFraction >= 0.01 ? 'reduced' : 'pilot'

  return {
    sizingHint: input.regimePolicy.sizingHint,
    bankrollFraction: roundedFraction,
    maxPositionUsdPer100kBankroll,
    maxLegUsdPer100kBankroll,
    maxLossUsdPer100kBankroll,
    confidenceTier,
    reasons,
  }
}

function reasonFor(primary: JoinedLeg | undefined, action: ExecutionSynthesisAction, riskLevel: ExecutionRiskLevel): string {
  if (!primary) return 'no_joined_execution_legs'
  if (action === 'execute') {
    if (primary.ranking.adverseMoveBeforePassive === true) return 'execution_eligible_but_adverse_risk_present'
    if (primary.ranking.futureCaptureCount === 0) return 'execution_eligible_without_future_path_confirmation'
    return 'execution_eligible_with_best_execution_score'
  }
  if (primary.ranking.actionability === 'blocked_candidate') return 'edge_present_but_blocked_by_market_eligibility'
  if (primary.ranking.actionability === 'watch_only') return 'edge_present_but_not_execution_grade'
  return `research_only_due_to_${riskLevel}_risk_profile`
}

function sortLegs(legs: JoinedLeg[]): JoinedLeg[] {
  return [...legs].sort(
    (a, b) =>
      b.ranking.executionScore - a.ranking.executionScore ||
      b.ranking.researchScore - a.ranking.researchScore ||
      a.ranking.provider.localeCompare(b.ranking.provider),
  )
}

function buildRows(
  ranking: ExecutionRankingReport,
  labeled: LabeledExecutionDataset,
  pathByKey: Map<string, RecapturePathSummary>,
): ExecutionSynthesisRow[] {
  const labeledByKey = new Map(
    labeled.rows.map((row) => [
      keyForParts({
        capturedAt: row.capturedAt,
        matchId: row.matchId,
        flashscoreMatchUrl: row.flashscoreMatchUrl,
        provider: row.provider,
        side: row.side,
        setupType: row.setupType,
        legRole: row.legRole,
      }),
      row,
    ]),
  )

  const joinedRows: JoinedLeg[] = ranking.topRows
    .map((row) => {
      const labeledRow = labeledByKey.get(
        keyForParts({
          capturedAt: row.capturedAt,
          matchId: row.matchId,
          flashscoreMatchUrl: row.flashscoreMatchUrl,
          provider: row.provider,
          side: row.side,
          setupType: row.setupType,
          legRole: row.legRole,
        }),
      )
      if (!labeledRow) return null
      return { ranking: row, labeled: labeledRow }
    })
    .filter((row): row is JoinedLeg => row != null)

  const byComparison = new Map<string, JoinedLeg[]>()
  for (const row of joinedRows) {
    const key = comparisonKey(row.ranking)
    const bucket = byComparison.get(key)
    if (bucket) bucket.push(row)
    else byComparison.set(key, [row])
  }

  return [...byComparison.values()]
    .map((legs) => {
      const sorted = sortLegs(legs)
      const primary = sorted[0]
      const action = inferAction(sorted)
      const riskLevel = inferRiskLevel(sorted, action)
      const sizingHint = inferSizingHint(primary, action, riskLevel)
      const path = primary
        ? pathByKey.get(
            pathKeyForRow({
              matchId: primary.ranking.matchId,
              flashscoreMatchUrl: primary.ranking.flashscoreMatchUrl,
              teamA: primary.ranking.teamA,
              teamB: primary.ranking.teamB,
            }),
          ) || null
        : null
      const regimeTag = inferRegimeTag(path)
      const executionEligibleLegCount = sorted.filter((leg) => leg.ranking.executionEligible).length
      const pathContext = {
        captureCount: path?.captureCount ?? 1,
        durationSeconds: path?.durationSeconds ?? 0,
        bothAvailableCount: path?.bothAvailableCount ?? 0,
        crossMarketRangeA: path?.crossMarket.rangeSpreadA ?? null,
        crossMarketSignChangeCount: path?.crossMarket.signChangeCount ?? 0,
        kalshiActionTransitionCount: path?.kalshi.actionTransitionCount ?? 0,
        polymarketActionTransitionCount: path?.polymarket.actionTransitionCount ?? 0,
      }
      const regimePolicy = applyRegimePolicy({
        action,
        sizingHint,
        riskLevel,
        regimeTag,
        pathContext,
      })
      const positionSizingPolicy = buildPositionSizingPolicy({
        regimePolicy,
        riskLevel,
        primaryLeg: primary,
        supportingLegCount: Math.max(0, sorted.length - 1),
      })
      return {
        capturedAt: primary?.ranking.capturedAt ?? '',
        matchId: primary?.ranking.matchId ?? null,
        flashscoreMatchUrl: primary?.ranking.flashscoreMatchUrl ?? null,
        teamA: primary?.ranking.teamA ?? null,
        teamB: primary?.ranking.teamB ?? null,
        tourType: primary?.ranking.tourType ?? 'UNKNOWN',
        qualityTier: primary?.ranking.qualityTier ?? 'unknown',
        setupType: primary?.ranking.setupType ?? 'unknown',
        action,
        riskLevel,
        sizingHint,
        regimeTag,
        pathContext,
        regimePolicy,
        positionSizingPolicy,
        shortlistEligible: executionEligibleLegCount > 0,
        executionEligibleLegCount,
        primaryLeg: primary ? legFrom(primary) : null,
        supportingLegs: sorted.slice(1).map(legFrom),
        reason: reasonFor(primary, action, riskLevel),
      } satisfies ExecutionSynthesisRow
    })
    .sort((a, b) => {
      const rank = { execute: 0, research_only: 1, ignore: 2 }
      const risk = { low: 0, medium: 1, high: 2, extreme: 3 }
      return (
        rank[a.action] - rank[b.action] ||
        risk[a.riskLevel] - risk[b.riskLevel] ||
        (b.primaryLeg?.executionScore ?? -Infinity) - (a.primaryLeg?.executionScore ?? -Infinity)
      )
    })
}

export async function buildExecutionSynthesis(
  rootDir: string,
  options: {
    includeWatchOnly?: boolean
    includeBlocked?: boolean
    rankingLimit?: number
  } = {},
): Promise<ExecutionSynthesisReport> {
  const ranking = await buildExecutionRankingReport(rootDir, {
    includeWatchOnly: options.includeWatchOnly,
    includeBlocked: options.includeBlocked,
    limit: options.rankingLimit ?? 500,
  })
  const labeled = await buildLabeledExecutionDataset(rootDir, {
    includeWatchOnly: options.includeWatchOnly,
    includeBlocked: options.includeBlocked,
  })
  const recapturePaths = await buildRecapturePathReport(rootDir)
  const pathByKey = new Map(
    recapturePaths.paths.map((path) => [
      pathKeyForRow({
        matchId: path.matchId,
        flashscoreMatchUrl: path.flashscoreMatchUrl,
        teamA: path.teamA,
        teamB: path.teamB,
      }),
      path,
    ]),
  )
  const rows = buildRows(ranking, labeled, pathByKey)

  return {
    version: 'execution-synthesis/v1',
    generatedAt: new Date().toISOString(),
    comparisonCount: labeled.comparisonCount,
    rowCount: rows.length,
    actionCounts: {
      execute: rows.filter((row) => row.action === 'execute').length,
      research_only: rows.filter((row) => row.action === 'research_only').length,
      ignore: rows.filter((row) => row.action === 'ignore').length,
    },
    riskCounts: {
      low: rows.filter((row) => row.riskLevel === 'low').length,
      medium: rows.filter((row) => row.riskLevel === 'medium').length,
      high: rows.filter((row) => row.riskLevel === 'high').length,
      extreme: rows.filter((row) => row.riskLevel === 'extreme').length,
    },
    rows,
  }
}
