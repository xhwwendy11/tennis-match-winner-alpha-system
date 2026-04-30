import type { PolymarketMatchWinnerPriceSummary } from './types.js'

export interface PolymarketEligibilityRule {
  minUsdVolume: number
  minTradeCount: number
  requireSettled: boolean
  requireAnyTrade: boolean
}

export interface PolymarketEligibilityResult {
  eligible: boolean
  reasons: string[]
}

export interface PolymarketEligibilityBucket {
  key: string
  marketCount: number
  eligibleCount: number
  eligibilityRate: number | null
  meanUsdVolume: number | null
  meanTradeCount: number | null
}

export interface PolymarketEligibilityReport {
  version: 'polymarket-eligibility-report/v1'
  generatedAt: string
  inputPath?: string
  rule: PolymarketEligibilityRule
  overall: PolymarketEligibilityBucket
  byCompetitionHint: PolymarketEligibilityBucket[]
  byReason: PolymarketEligibilityBucket[]
  eligibleTopByUsdVolume: Array<{
    marketId: string
    question: string | null
    competitionHint: string | null
    usdVolume: number
    tradeCount: number
  }>
}

export const DEFAULT_POLYMARKET_ELIGIBILITY_RULE: PolymarketEligibilityRule = {
  minUsdVolume: 1_000,
  minTradeCount: 20,
  requireSettled: true,
  requireAnyTrade: true,
}

function round(value: number | null, decimals = 4): number | null {
  if (value == null || !Number.isFinite(value)) return null
  const scale = 10 ** decimals
  return Math.round(value * scale) / scale
}

function mean(values: number[]): number | null {
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function evaluatePolymarketEligibility(
  summary: PolymarketMatchWinnerPriceSummary,
  rule: PolymarketEligibilityRule = DEFAULT_POLYMARKET_ELIGIBILITY_RULE,
): PolymarketEligibilityResult {
  const reasons: string[] = []
  if (rule.requireSettled && summary.winner === 'unknown') reasons.push('unsettled')
  if (rule.requireAnyTrade && summary.tradeCount <= 0) reasons.push('no_trades')
  if ((summary.usdVolume || 0) < rule.minUsdVolume) reasons.push('low_usd_volume')
  if ((summary.tradeCount || 0) < rule.minTradeCount) reasons.push('low_trade_count')
  return {
    eligible: reasons.length === 0,
    reasons,
  }
}

function toBucket(
  key: string,
  summaries: PolymarketMatchWinnerPriceSummary[],
  rule: PolymarketEligibilityRule,
): PolymarketEligibilityBucket {
  const usdVolumes = summaries.map((summary) => summary.usdVolume || 0)
  const tradeCounts = summaries.map((summary) => summary.tradeCount || 0)
  const eligibleCount = summaries.filter((summary) => evaluatePolymarketEligibility(summary, rule).eligible).length
  return {
    key,
    marketCount: summaries.length,
    eligibleCount,
    eligibilityRate: round(summaries.length ? eligibleCount / summaries.length : null, 4),
    meanUsdVolume: round(mean(usdVolumes), 2),
    meanTradeCount: round(mean(tradeCounts), 2),
  }
}

function bucketize(
  summaries: PolymarketMatchWinnerPriceSummary[],
  keyFn: (summary: PolymarketMatchWinnerPriceSummary) => string[],
  rule: PolymarketEligibilityRule,
): PolymarketEligibilityBucket[] {
  const buckets = new Map<string, PolymarketMatchWinnerPriceSummary[]>()
  for (const summary of summaries) {
    for (const key of keyFn(summary)) {
      const group = buckets.get(key)
      if (group) group.push(summary)
      else buckets.set(key, [summary])
    }
  }
  return [...buckets.entries()]
    .map(([key, group]) => toBucket(key, group, rule))
    .sort((a, b) => b.marketCount - a.marketCount || a.key.localeCompare(b.key))
}

export function buildPolymarketEligibilityReport(
  summaries: PolymarketMatchWinnerPriceSummary[],
  options: { inputPath?: string; rule?: PolymarketEligibilityRule } = {},
): PolymarketEligibilityReport {
  const rule = options.rule || DEFAULT_POLYMARKET_ELIGIBILITY_RULE
  const eligibleSummaries = summaries.filter((summary) => evaluatePolymarketEligibility(summary, rule).eligible)

  return {
    version: 'polymarket-eligibility-report/v1',
    generatedAt: new Date().toISOString(),
    inputPath: options.inputPath,
    rule,
    overall: toBucket('overall', summaries, rule),
    byCompetitionHint: bucketize(summaries, (summary) => [summary.competitionHint || 'UNKNOWN'], rule),
    byReason: bucketize(
      summaries,
      (summary) => {
        const result = evaluatePolymarketEligibility(summary, rule)
        return result.eligible ? ['eligible'] : result.reasons
      },
      rule,
    ),
    eligibleTopByUsdVolume: [...eligibleSummaries]
      .sort((a, b) => (b.usdVolume || 0) - (a.usdVolume || 0))
      .slice(0, 10)
      .map((summary) => ({
        marketId: summary.marketId,
        question: summary.question,
        competitionHint: summary.competitionHint,
        usdVolume: round(summary.usdVolume, 2) || 0,
        tradeCount: summary.tradeCount,
      })),
  }
}
