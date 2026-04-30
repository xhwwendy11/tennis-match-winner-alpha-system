import type { CanonicalMarketState } from './canonicalMarketState.js'
import type { FairMarketComparison } from './fairMarketComparison.js'

export interface MarketEligibilityRule {
  provider: CanonicalMarketState['provider']
  requireOpen: boolean
  requireFairComparison: boolean
  requireLastPrice: boolean
  requireTwoSidedAsk: boolean
  minVolume: number
  maxAskOverround: number
  maxMarketAgeSeconds: number
}

export interface MarketEligibility {
  eligible: boolean
  reasons: string[]
  metrics: {
    provider: CanonicalMarketState['provider']
    volume: number | null
    marketStatus: CanonicalMarketState['marketStatus'] | null
    marketProbALast: number | null
    marketProbBLast: number | null
    marketProbAAsk: number | null
    marketProbBAsk: number | null
    askOverround: number | null
    marketAgeSeconds: number | null
  }
  rule: MarketEligibilityRule
}

export const DEFAULT_KALSHI_MARKET_ELIGIBILITY_RULE: MarketEligibilityRule = {
  provider: 'kalshi',
  requireOpen: true,
  requireFairComparison: true,
  requireLastPrice: true,
  requireTwoSidedAsk: true,
  minVolume: 500_000,
  maxAskOverround: 0.02,
  maxMarketAgeSeconds: 10,
}

export const DEFAULT_POLYMARKET_MARKET_ELIGIBILITY_RULE: MarketEligibilityRule = {
  provider: 'polymarket',
  requireOpen: true,
  requireFairComparison: true,
  requireLastPrice: true,
  requireTwoSidedAsk: true,
  minVolume: 5_000,
  maxAskOverround: 0.03,
  maxMarketAgeSeconds: 600,
}

export const DEFAULT_UNKNOWN_MARKET_ELIGIBILITY_RULE: MarketEligibilityRule = {
  ...DEFAULT_KALSHI_MARKET_ELIGIBILITY_RULE,
  provider: 'unknown',
}

function overround(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null
  return a + b - 1
}

const EPSILON = 1e-9

function parseIso(value: string | null | undefined): number | null {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp / 1000 : null
}

export function buildMarketEligibility(input: {
  marketState: CanonicalMarketState | null
  fairVsMarket: FairMarketComparison
  capturedAt?: string | null
  rule?: Partial<MarketEligibilityRule>
}): MarketEligibility {
  const provider = input.marketState?.provider ?? 'unknown'
  const providerDefaultRule =
    provider === 'kalshi'
      ? DEFAULT_KALSHI_MARKET_ELIGIBILITY_RULE
      : provider === 'polymarket'
        ? DEFAULT_POLYMARKET_MARKET_ELIGIBILITY_RULE
        : DEFAULT_UNKNOWN_MARKET_ELIGIBILITY_RULE

  const rule: MarketEligibilityRule = {
    ...providerDefaultRule,
    ...(input.rule || {}),
  }

  const marketStatus = input.marketState?.marketStatus ?? null
  const volume = input.marketState?.liquidity.volume ?? null
  const marketProbALast = input.fairVsMarket.marketProbA.last
  const marketProbBLast = input.fairVsMarket.marketProbB.last
  const marketProbAAsk = input.fairVsMarket.marketProbA.ask
  const marketProbBAsk = input.fairVsMarket.marketProbB.ask
  const askOverround = overround(marketProbAAsk, marketProbBAsk)
  const capturedAtSeconds = parseIso(input.capturedAt)
  const marketTimestampSeconds = parseIso(input.marketState?.timestamps.marketTimestamp)
  const marketAgeSeconds = capturedAtSeconds != null && marketTimestampSeconds != null
    ? capturedAtSeconds - marketTimestampSeconds
    : null

  const reasons: string[] = []
  if (rule.requireOpen && marketStatus !== 'OPEN') reasons.push('market_not_open')
  if (rule.requireFairComparison && !input.fairVsMarket.available) reasons.push('fair_comparison_unavailable')
  if (rule.requireLastPrice && (marketProbALast == null || marketProbBLast == null)) reasons.push('missing_last_price')
  if (rule.requireTwoSidedAsk && (marketProbAAsk == null || marketProbBAsk == null)) reasons.push('missing_two_sided_ask')
  if (typeof volume !== 'number' || !Number.isFinite(volume) || volume < rule.minVolume) reasons.push('low_volume')
  if (rule.requireTwoSidedAsk) {
    if (askOverround == null) reasons.push('missing_ask_overround')
    else if (askOverround - rule.maxAskOverround > EPSILON) reasons.push('wide_ask_overround')
  }
  if (marketAgeSeconds == null) reasons.push('missing_market_age')
  else if (marketAgeSeconds > rule.maxMarketAgeSeconds) reasons.push('stale_market_timestamp')

  return {
    eligible: reasons.length === 0,
    reasons,
    metrics: {
      provider,
      volume,
      marketStatus,
      marketProbALast,
      marketProbBLast,
      marketProbAAsk,
      marketProbBAsk,
      askOverround,
      marketAgeSeconds,
    },
    rule,
  }
}
